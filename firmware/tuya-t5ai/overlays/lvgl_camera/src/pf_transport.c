#include "pf_transport.h"

#include "pf_demo_config.h"
#include "tal_api.h"
#include "tal_network.h"
#include "tal_wifi.h"

#define PF_DEDUP_WINDOW_SIZE 16U
#define PF_RETRY_SLOT_COUNT  4U
#define PF_TRANSPORT_POLL_MS 10U

typedef struct {
    bool active;
    PF_MESSAGE_T message;
    uint8_t retries_left;
    uint32_t next_retry_ms;
} PF_RETRY_SLOT_T;

static MUTEX_HANDLE sg_transport_mutex;
static THREAD_HANDLE sg_transport_thread;
static TIMER_ID sg_heartbeat_timer;
static PF_TRANSPORT_CB sg_event_cb;
static void *sg_event_ctx;
static volatile bool sg_running;
static bool sg_initialized;
static bool sg_wifi_connected;
static bool sg_peer_online;
static int sg_socket_fd = -1;
static TUYA_IP_ADDR_T sg_peer_addr;
static uint32_t sg_last_peer_ms;
static uint32_t sg_last_peer_sequence;
static uint32_t sg_next_sequence;
static uint32_t sg_next_message_id;
static uint32_t sg_seen_message_ids[PF_DEDUP_WINDOW_SIZE];
static uint8_t sg_seen_count;
static uint8_t sg_seen_next;
static PF_RETRY_SLOT_T sg_retry_slots[PF_RETRY_SLOT_COUNT];

static uint32_t pf_now_ms(void)
{
    return (uint32_t)tal_system_get_millisecond();
}

static bool pf_deadline_reached(uint32_t now, uint32_t deadline)
{
    return (int32_t)(now - deadline) >= 0;
}

static bool pf_elapsed(uint32_t now, uint32_t then, uint32_t interval)
{
    return (uint32_t)(now - then) >= interval;
}

static void pf_notify(PF_TRANSPORT_EVENT_E event, const PF_MESSAGE_T *message)
{
    if (sg_event_cb != NULL) {
        sg_event_cb(event, message, sg_event_ctx);
    }
}

static void pf_clear_peer_locked(void)
{
    sg_peer_online = false;
    sg_peer_addr = 0;
    sg_last_peer_ms = 0;
    sg_last_peer_sequence = 0;
    sg_seen_count = 0;
    sg_seen_next = 0;
    memset(sg_seen_message_ids, 0, sizeof(sg_seen_message_ids));
}

static void pf_close_socket_locked(void)
{
    if (sg_socket_fd >= 0) {
        tal_net_close(sg_socket_fd);
        sg_socket_fd = -1;
    }
    memset(sg_retry_slots, 0, sizeof(sg_retry_slots));
    pf_clear_peer_locked();
}

static OPERATE_RET pf_open_socket_locked(void)
{
    int fd = tal_net_socket_create(PROTOCOL_UDP);
    if (fd < 0) {
        return OPRT_COM_ERROR;
    }

    if (tal_net_set_reuse(fd) != OPRT_OK ||
        tal_net_set_broadcast(fd) != OPRT_OK ||
        tal_net_set_block(fd, FALSE) != OPRT_OK ||
        tal_net_bind(fd, TY_IPADDR_ANY, PF_UDP_PORT) != 0) {
        tal_net_close(fd);
        return OPRT_COM_ERROR;
    }

    sg_socket_fd = fd;
    return OPRT_OK;
}

static OPERATE_RET pf_send_locked(const PF_MESSAGE_T *message)
{
    uint8_t wire[PF_WIRE_PACKET_SIZE];
    TUYA_IP_ADDR_T destination;
    TUYA_ERRNO sent;

    if (sg_socket_fd < 0 || message == NULL) {
        return OPRT_RESOURCE_NOT_READY;
    }

    if (pf_protocol_encode(message, wire) != OPRT_OK) {
        return OPRT_INVALID_PARM;
    }

    destination = (message->type == PF_MSG_HELLO || !sg_peer_online)
                      ? TY_IPADDR_BROADCAST
                      : sg_peer_addr;
    sent = tal_net_send_to(sg_socket_fd, wire, sizeof(wire),
                           destination, PF_UDP_PORT);
    return sent == (TUYA_ERRNO)sizeof(wire) ? OPRT_OK : OPRT_COM_ERROR;
}

static bool pf_message_seen_locked(uint32_t message_id)
{
    uint8_t i;

    for (i = 0; i < sg_seen_count; ++i) {
        if (sg_seen_message_ids[i] == message_id) {
            return true;
        }
    }

    sg_seen_message_ids[sg_seen_next] = message_id;
    sg_seen_next = (uint8_t)((sg_seen_next + 1U) % PF_DEDUP_WINDOW_SIZE);
    if (sg_seen_count < PF_DEDUP_WINDOW_SIZE) {
        ++sg_seen_count;
    }
    return false;
}

static void pf_receive_once(void)
{
    uint8_t wire[PF_WIRE_PACKET_SIZE + 1U];
    PF_MESSAGE_T message;
    TUYA_IP_ADDR_T source_addr = 0;
    uint16_t source_port = 0;
    TUYA_ERRNO received;
    bool peer_found = false;
    bool deliver = false;
    bool duplicate;

    tal_mutex_lock(sg_transport_mutex);
    if (sg_socket_fd < 0) {
        tal_mutex_unlock(sg_transport_mutex);
        return;
    }
    received = tal_net_recvfrom(sg_socket_fd, wire, sizeof(wire),
                                &source_addr, &source_port);
    tal_mutex_unlock(sg_transport_mutex);

    if (received <= 0 ||
        pf_protocol_decode(wire, (uint32_t)received, &message) != OPRT_OK ||
        message.device_id == PF_DEVICE_ID ||
        message.device_id != PF_PEER_ID ||
        source_port != PF_UDP_PORT) {
        return;
    }

    tal_mutex_lock(sg_transport_mutex);
    if (!sg_running || sg_socket_fd < 0) {
        tal_mutex_unlock(sg_transport_mutex);
        return;
    }

    duplicate = pf_message_seen_locked(message.message_id);
    if (!duplicate && message.sequence <= sg_last_peer_sequence) {
        tal_mutex_unlock(sg_transport_mutex);
        return;
    }

    sg_peer_addr = source_addr;
    sg_last_peer_ms = pf_now_ms();
    if (!sg_peer_online) {
        sg_peer_online = true;
        peer_found = true;
    }

    if (!duplicate) {
        sg_last_peer_sequence = message.sequence;
        deliver = message.type != PF_MSG_HELLO;
    }
    tal_mutex_unlock(sg_transport_mutex);

    if (peer_found) {
        pf_notify(PF_TRANSPORT_PEER_FOUND, &message);
    }
    if (deliver) {
        pf_notify(PF_TRANSPORT_MESSAGE, &message);
    }
}

static void pf_process_retries(uint32_t now)
{
    uint8_t i;

    tal_mutex_lock(sg_transport_mutex);
    for (i = 0; i < PF_RETRY_SLOT_COUNT; ++i) {
        PF_RETRY_SLOT_T *slot = &sg_retry_slots[i];
        if (!slot->active || !pf_deadline_reached(now, slot->next_retry_ms)) {
            continue;
        }

        (void)pf_send_locked(&slot->message);
        if (--slot->retries_left == 0U) {
            slot->active = false;
        } else {
            slot->next_retry_ms = now + PF_CRITICAL_RETRY_GAP_MS;
        }
    }
    tal_mutex_unlock(sg_transport_mutex);
}

static void pf_check_peer_timeout(uint32_t now)
{
    bool peer_lost = false;

    tal_mutex_lock(sg_transport_mutex);
    if (sg_peer_online &&
        pf_elapsed(now, sg_last_peer_ms, PF_PEER_TIMEOUT_MS)) {
        pf_clear_peer_locked();
        peer_lost = true;
    }
    tal_mutex_unlock(sg_transport_mutex);

    if (peer_lost) {
        pf_notify(PF_TRANSPORT_PEER_LOST, NULL);
    }
}

static void pf_transport_task(void *arg)
{
    THREAD_HANDLE self;
    (void)arg;

    while (sg_running) {
        uint32_t now = pf_now_ms();
        pf_receive_once();
        pf_process_retries(now);
        pf_check_peer_timeout(now);
        tal_system_sleep(PF_TRANSPORT_POLL_MS);
    }

    self = sg_transport_thread;
    sg_transport_thread = NULL;
    tal_thread_delete(self);
}

static void pf_heartbeat_cb(TIMER_ID timer_id, void *arg)
{
    (void)timer_id;
    (void)arg;
    (void)pf_transport_send(PF_MSG_HELLO, 0U, 0, false);
}

static void pf_wifi_event_cb(WF_EVENT_E event, void *arg)
{
    bool peer_lost = false;
    (void)arg;

    if (event == WFE_CONNECTED) {
        NW_IP_S station_ip;
        memset(&station_ip, 0, sizeof(station_ip));
        if (tal_wifi_get_ip(WF_STATION, &station_ip) != OPRT_OK) {
            PR_ERR("[transport] failed to read station IP");
            return;
        }

        tal_mutex_lock(sg_transport_mutex);
        if (!sg_running) {
            tal_mutex_unlock(sg_transport_mutex);
            return;
        }
        pf_close_socket_locked();
        sg_wifi_connected = true;
        if (pf_open_socket_locked() != OPRT_OK) {
            PR_ERR("[transport] failed to open UDP socket");
        }
        tal_mutex_unlock(sg_transport_mutex);

        tal_sw_timer_start(sg_heartbeat_timer, PF_HEARTBEAT_MS,
                           TAL_TIMER_CYCLE);
        (void)pf_transport_send(PF_MSG_HELLO, 0U, 0, false);
        PR_NOTICE("[transport] Wi-Fi connected: %s", station_ip.ip);
        pf_notify(PF_TRANSPORT_WIFI_CONNECTED, NULL);
        return;
    }

    if (event == WFE_DISCONNECTED || event == WFE_CONNECT_FAILED) {
        tal_sw_timer_stop(sg_heartbeat_timer);
        tal_mutex_lock(sg_transport_mutex);
        peer_lost = sg_peer_online;
        sg_wifi_connected = false;
        pf_close_socket_locked();
        tal_mutex_unlock(sg_transport_mutex);

        if (peer_lost) {
            pf_notify(PF_TRANSPORT_PEER_LOST, NULL);
        }
        pf_notify(PF_TRANSPORT_WIFI_LOST, NULL);
    }
}

OPERATE_RET pf_transport_init(PF_TRANSPORT_CB cb, void *ctx)
{
    OPERATE_RET rt;

    if (cb == NULL || sg_initialized) {
        return OPRT_INVALID_PARM;
    }

    rt = tal_mutex_create_init(&sg_transport_mutex);
    if (rt != OPRT_OK) {
        return rt;
    }
    rt = tal_sw_timer_create(pf_heartbeat_cb, NULL, &sg_heartbeat_timer);
    if (rt != OPRT_OK) {
        tal_mutex_release(sg_transport_mutex);
        sg_transport_mutex = NULL;
        return rt;
    }

    sg_event_cb = cb;
    sg_event_ctx = ctx;
    sg_next_sequence = 1U;
    sg_next_message_id = 1U;
    sg_initialized = true;
    return OPRT_OK;
}

OPERATE_RET pf_transport_start(void)
{
    THREAD_CFG_T thread_cfg = {
        .stackDepth = 4096,
        .priority = THREAD_PRIO_2,
        .thrdname = "pf_transport",
    };
    OPERATE_RET rt;

    if (!sg_initialized || sg_running || sg_transport_thread != NULL) {
        return OPRT_INVALID_PARM;
    }

    sg_running = true;
    rt = tal_thread_create_and_start(&sg_transport_thread, NULL, NULL,
                                     pf_transport_task, NULL, &thread_cfg);
    if (rt != OPRT_OK) {
        sg_running = false;
        return rt;
    }

    rt = tal_wifi_init(pf_wifi_event_cb);
    if (rt == OPRT_OK) {
        rt = tal_wifi_set_work_mode(WWM_STATION);
    }
    if (rt == OPRT_OK) {
        rt = tal_wifi_station_connect((int8_t *)PF_WIFI_SSID,
                                      (int8_t *)PF_WIFI_PASSWORD);
    }
    if (rt != OPRT_OK) {
        sg_running = false;
    }
    return rt;
}

OPERATE_RET pf_transport_send(PF_MESSAGE_TYPE_E type,
                              uint32_t session_id,
                              int32_t result,
                              bool critical)
{
    PF_MESSAGE_T message;
    PF_RETRY_SLOT_T *retry_slot = NULL;
    OPERATE_RET rt;
    uint8_t i;

    if (!sg_initialized || type < PF_MSG_HELLO || type > PF_MSG_RESET) {
        return OPRT_INVALID_PARM;
    }

    tal_mutex_lock(sg_transport_mutex);
    if (sg_socket_fd < 0) {
        tal_mutex_unlock(sg_transport_mutex);
        return OPRT_RESOURCE_NOT_READY;
    }

    if (critical && PF_CRITICAL_RETRY_COUNT > 1U) {
        for (i = 0; i < PF_RETRY_SLOT_COUNT; ++i) {
            if (!sg_retry_slots[i].active) {
                retry_slot = &sg_retry_slots[i];
                break;
            }
        }
        if (retry_slot == NULL) {
            tal_mutex_unlock(sg_transport_mutex);
            return OPRT_RESOURCE_NOT_READY;
        }
    }

    memset(&message, 0, sizeof(message));
    message.version = PF_PROTOCOL_VERSION;
    message.type = (uint8_t)type;
    message.device_id = PF_DEVICE_ID;
    message.session_id = session_id;
    message.message_id = sg_next_message_id++;
    message.sequence = sg_next_sequence++;
    message.timestamp_ms = pf_now_ms();
    message.result = result;

    rt = pf_send_locked(&message);
    if (rt == OPRT_OK && retry_slot != NULL) {
        retry_slot->active = true;
        retry_slot->message = message;
        retry_slot->retries_left = (uint8_t)(PF_CRITICAL_RETRY_COUNT - 1U);
        retry_slot->next_retry_ms = message.timestamp_ms +
                                    PF_CRITICAL_RETRY_GAP_MS;
    }
    tal_mutex_unlock(sg_transport_mutex);
    return rt;
}

void pf_transport_stop(void)
{
    if (!sg_initialized) {
        return;
    }

    tal_sw_timer_stop(sg_heartbeat_timer);
    tal_mutex_lock(sg_transport_mutex);
    sg_running = false;
    sg_wifi_connected = false;
    pf_close_socket_locked();
    tal_mutex_unlock(sg_transport_mutex);
}
