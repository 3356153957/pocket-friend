#include "pf_wifi_config.h"

#include "pf_demo_runtime_config.h"
#include "tal_api.h"
#include "tal_kv.h"
#include "tal_wifi.h"

#define PF_WIFI_COMMAND_QUEUE_LENGTH 8U
#define PF_WIFI_TASK_STACK_SIZE 4096U
#define PF_WIFI_SSID_KEY "pf_wifi_ssid"
#define PF_WIFI_PASSWORD_KEY "pf_wifi_password"
#define PF_WIFI_AUTO_RETRY_COUNT 3U

typedef enum {
    PF_WIFI_COMMAND_START,
    PF_WIFI_COMMAND_SCAN,
    PF_WIFI_COMMAND_CONNECT,
    PF_WIFI_COMMAND_LINK_CONNECTED,
    PF_WIFI_COMMAND_LINK_FAILED,
    PF_WIFI_COMMAND_LINK_DISCONNECTED,
} PF_WIFI_COMMAND_TYPE_E;

typedef struct {
    PF_WIFI_COMMAND_TYPE_E type;
    uint8_t ap_index;
    char password[PF_WIFI_PASSWORD_MAX + 1U];
} PF_WIFI_COMMAND_T;

static QUEUE_HANDLE sg_wifi_queue;
static THREAD_HANDLE sg_wifi_thread;
static MUTEX_HANDLE sg_wifi_mutex;
static PF_WIFI_CB sg_wifi_cb;
static void *sg_wifi_cb_ctx;
static PF_WIFI_AP_T sg_scan_results[PF_WIFI_MAX_APS];
static uint8_t sg_scan_count;
static char sg_target_ssid[PF_WIFI_SSID_MAX + 1U];
static char sg_target_password[PF_WIFI_PASSWORD_MAX + 1U];
static char sg_station_ip[40] = "0.0.0.0";
static bool sg_connected;
static bool sg_pending_save;
static bool sg_auto_connect;
static uint8_t sg_retry_count;
static bool sg_initialized;

static void pf_wifi_notify(PF_WIFI_EVENT_E event)
{
    if (sg_wifi_cb != NULL) {
        sg_wifi_cb(event, sg_wifi_cb_ctx);
    }
}

static void pf_wifi_post_command(PF_WIFI_COMMAND_TYPE_E type)
{
    PF_WIFI_COMMAND_T command;

    if (sg_wifi_queue == NULL) {
        return;
    }
    memset(&command, 0, sizeof(command));
    command.type = type;
    if (tal_queue_post(sg_wifi_queue, &command, 0) != OPRT_OK) {
        PR_ERR("[wifi] command queue full: %d", type);
    }
}

static OPERATE_RET pf_wifi_read_kv_string(const char *key, char *out,
                                          size_t capacity)
{
    uint8_t *value = NULL;
    size_t length = 0;
    OPERATE_RET rt;

    if (key == NULL || out == NULL || capacity == 0U) {
        return OPRT_INVALID_PARM;
    }
    out[0] = '\0';
    rt = tal_kv_get(key, &value, &length);
    if (rt != OPRT_OK) {
        return rt;
    }
    if (value == NULL || length == 0U || length > capacity ||
        value[length - 1U] != '\0') {
        if (value != NULL) {
            (void)tal_kv_free(value);
        }
        return OPRT_INVALID_PARM;
    }
    memcpy(out, value, length);
    (void)tal_kv_free(value);
    return OPRT_OK;
}

static void pf_wifi_clear_saved_credentials(void)
{
    (void)tal_kv_del(PF_WIFI_SSID_KEY);
    (void)tal_kv_del(PF_WIFI_PASSWORD_KEY);
}

static OPERATE_RET pf_wifi_load_credentials(char *ssid, char *password)
{
    OPERATE_RET rt;

    rt = pf_wifi_read_kv_string(PF_WIFI_SSID_KEY, ssid,
                                PF_WIFI_SSID_MAX + 1U);
    if (rt != OPRT_OK || ssid[0] == '\0') {
        pf_wifi_clear_saved_credentials();
        return OPRT_NOT_FOUND;
    }
    rt = pf_wifi_read_kv_string(PF_WIFI_PASSWORD_KEY, password,
                                PF_WIFI_PASSWORD_MAX + 1U);
    if (rt != OPRT_OK) {
        pf_wifi_clear_saved_credentials();
        return OPRT_NOT_FOUND;
    }
    return OPRT_OK;
}

static OPERATE_RET pf_wifi_save_credentials(void)
{
    OPERATE_RET rt;

    rt = tal_kv_set(PF_WIFI_PASSWORD_KEY,
                    (const uint8_t *)sg_target_password,
                    strlen(sg_target_password) + 1U);
    if (rt == OPRT_OK) {
        rt = tal_kv_set(PF_WIFI_SSID_KEY,
                        (const uint8_t *)sg_target_ssid,
                        strlen(sg_target_ssid) + 1U);
    }
    if (rt != OPRT_OK) {
        (void)tal_kv_del(PF_WIFI_SSID_KEY);
    }
    return rt;
}

static int pf_wifi_find_ssid(PF_WIFI_AP_T *results, uint8_t count,
                             const char *ssid)
{
    uint8_t i;

    for (i = 0U; i < count; ++i) {
        if (strcmp(results[i].ssid, ssid) == 0) {
            return (int)i;
        }
    }
    return -1;
}

static void pf_wifi_sort_results(PF_WIFI_AP_T *results, uint8_t count)
{
    uint8_t i;
    uint8_t j;

    for (i = 0U; i < count; ++i) {
        for (j = (uint8_t)(i + 1U); j < count; ++j) {
            if (results[j].rssi > results[i].rssi) {
                PF_WIFI_AP_T swap = results[i];
                results[i] = results[j];
                results[j] = swap;
            }
        }
    }
}

static void pf_wifi_copy_ap(PF_WIFI_AP_T *target, const AP_IF_S *source)
{
    size_t length = source->s_len;

    if (length == 0U) {
        length = strnlen((const char *)source->ssid, PF_WIFI_SSID_MAX);
    }
    if (length > PF_WIFI_SSID_MAX) {
        length = PF_WIFI_SSID_MAX;
    }
    memset(target, 0, sizeof(*target));
    memcpy(target->ssid, source->ssid, length);
    target->ssid[length] = '\0';
    target->rssi = source->rssi;
    target->security = source->security;
}

static void pf_wifi_perform_scan(void)
{
    PF_WIFI_AP_T results[PF_WIFI_MAX_APS];
    AP_IF_S *ap_list = NULL;
    uint32_t ap_count = 0U;
    uint8_t result_count = 0U;
    uint32_t i;
    OPERATE_RET rt;

    memset(results, 0, sizeof(results));
    pf_wifi_notify(PF_WIFI_EVENT_SCAN_STARTED);
    rt = tal_wifi_all_ap_scan(&ap_list, &ap_count);
    if (rt == OPRT_OK && ap_list != NULL) {
        for (i = 0U; i < ap_count; ++i) {
            PF_WIFI_AP_T candidate;
            int existing;

            pf_wifi_copy_ap(&candidate, &ap_list[i]);
            if (candidate.ssid[0] == '\0') {
                continue;
            }
            existing = pf_wifi_find_ssid(results, result_count,
                                         candidate.ssid);
            if (existing >= 0) {
                if (candidate.rssi > results[existing].rssi) {
                    results[existing] = candidate;
                }
            } else if (result_count < PF_WIFI_MAX_APS) {
                results[result_count++] = candidate;
            } else {
                pf_wifi_sort_results(results, result_count);
                if (candidate.rssi > results[result_count - 1U].rssi) {
                    results[result_count - 1U] = candidate;
                }
            }
        }
    }
    if (ap_list != NULL) {
        (void)tal_wifi_release_ap(ap_list);
        ap_list = NULL;
    }
    if (rt != OPRT_OK) {
        pf_wifi_notify(PF_WIFI_EVENT_SCAN_FAILED);
        return;
    }

    pf_wifi_sort_results(results, result_count);
    tal_mutex_lock(sg_wifi_mutex);
    memcpy(sg_scan_results, results, sizeof(results));
    sg_scan_count = result_count;
    tal_mutex_unlock(sg_wifi_mutex);
    pf_wifi_notify(PF_WIFI_EVENT_SCAN_COMPLETE);
}

static OPERATE_RET pf_wifi_begin_connect(const char *ssid,
                                         const char *password,
                                         bool save_on_success,
                                         bool auto_connect)
{
    OPERATE_RET rt;

    snprintf(sg_target_ssid, sizeof(sg_target_ssid), "%s", ssid);
    snprintf(sg_target_password, sizeof(sg_target_password), "%s", password);
    sg_pending_save = save_on_success;
    sg_auto_connect = auto_connect;
    sg_retry_count = 0U;
    sg_connected = false;
    pf_wifi_notify(PF_WIFI_EVENT_CONNECTING);
    rt = tal_wifi_station_connect((int8_t *)sg_target_ssid,
                                  (int8_t *)sg_target_password);
    if (rt != OPRT_OK) {
        pf_wifi_post_command(PF_WIFI_COMMAND_LINK_FAILED);
    }
    return rt;
}

static void pf_wifi_handle_connected(void)
{
    NW_IP_S ip;

    memset(&ip, 0, sizeof(ip));
    if (tal_wifi_get_ip(WF_STATION, &ip) != OPRT_OK) {
        pf_wifi_notify(PF_WIFI_EVENT_CONNECT_FAILED);
        return;
    }
    snprintf(sg_station_ip, sizeof(sg_station_ip), "%s", ip.ip);
    sg_connected = true;
    sg_retry_count = 0U;
    pf_wifi_notify(PF_WIFI_EVENT_CONNECTED);
    if (sg_pending_save && pf_wifi_save_credentials() != OPRT_OK) {
        pf_wifi_notify(PF_WIFI_EVENT_SAVE_FAILED);
    }
    sg_pending_save = false;
}

static void pf_wifi_handle_failed(void)
{
    uint32_t delay_ms;

    sg_connected = false;
    snprintf(sg_station_ip, sizeof(sg_station_ip), "0.0.0.0");
    if (sg_auto_connect && sg_retry_count < PF_WIFI_AUTO_RETRY_COUNT) {
        delay_ms = (1U << sg_retry_count) * 1000U;
        ++sg_retry_count;
        tal_system_sleep(delay_ms);
        if (tal_wifi_station_connect((int8_t *)sg_target_ssid,
                                     (int8_t *)sg_target_password) != OPRT_OK) {
            pf_wifi_post_command(PF_WIFI_COMMAND_LINK_FAILED);
        }
        return;
    }
    pf_wifi_notify(PF_WIFI_EVENT_CONNECT_FAILED);
}

static void pf_wifi_worker(void *arg)
{
    PF_WIFI_COMMAND_T command;
    char ssid[PF_WIFI_SSID_MAX + 1U];
    char password[PF_WIFI_PASSWORD_MAX + 1U];
    (void)arg;

    for (;;) {
        memset(&command, 0, sizeof(command));
        if (tal_queue_fetch(sg_wifi_queue, &command,
                            QUEUE_WAIT_FOREVER) != OPRT_OK) {
            continue;
        }
        switch (command.type) {
        case PF_WIFI_COMMAND_START:
            memset(ssid, 0, sizeof(ssid));
            memset(password, 0, sizeof(password));
            if (pf_wifi_load_credentials(ssid, password) == OPRT_OK) {
                (void)pf_wifi_begin_connect(ssid, password, false, true);
#if PF_DEFAULT_WIFI_ENABLED
            } else {
                (void)pf_wifi_begin_connect(PF_DEFAULT_WIFI_SSID,
                                            PF_DEFAULT_WIFI_PASSWORD,
                                            false, true);
#else
            } else {
                pf_wifi_notify(PF_WIFI_EVENT_UNCONFIGURED);
#endif
            }
            memset(password, 0, sizeof(password));
            break;
        case PF_WIFI_COMMAND_SCAN:
            pf_wifi_perform_scan();
            break;
        case PF_WIFI_COMMAND_CONNECT:
            tal_mutex_lock(sg_wifi_mutex);
            if (command.ap_index >= sg_scan_count ||
                (sg_scan_results[command.ap_index].security != WAAM_OPEN &&
                 command.password[0] == '\0')) {
                tal_mutex_unlock(sg_wifi_mutex);
                pf_wifi_notify(PF_WIFI_EVENT_CONNECT_FAILED);
                break;
            }
            snprintf(ssid, sizeof(ssid), "%s",
                     sg_scan_results[command.ap_index].ssid);
            tal_mutex_unlock(sg_wifi_mutex);
            (void)pf_wifi_begin_connect(ssid, command.password, true, false);
            break;
        case PF_WIFI_COMMAND_LINK_CONNECTED:
            pf_wifi_handle_connected();
            break;
        case PF_WIFI_COMMAND_LINK_FAILED:
            pf_wifi_handle_failed();
            break;
        case PF_WIFI_COMMAND_LINK_DISCONNECTED:
            sg_connected = false;
            snprintf(sg_station_ip, sizeof(sg_station_ip), "0.0.0.0");
            pf_wifi_notify(PF_WIFI_EVENT_DISCONNECTED);
            if (sg_target_ssid[0] != '\0') {
                sg_auto_connect = true;
                sg_retry_count = 0U;
                pf_wifi_handle_failed();
            }
            break;
        default:
            break;
        }
        memset(command.password, 0, sizeof(command.password));
    }
}

static void pf_wifi_driver_cb(WF_EVENT_E event, void *arg)
{
    (void)arg;
    if (event == WFE_CONNECTED) {
        pf_wifi_post_command(PF_WIFI_COMMAND_LINK_CONNECTED);
    } else if (event == WFE_CONNECT_FAILED) {
        pf_wifi_post_command(PF_WIFI_COMMAND_LINK_FAILED);
    } else if (event == WFE_DISCONNECTED) {
        pf_wifi_post_command(PF_WIFI_COMMAND_LINK_DISCONNECTED);
    }
}

OPERATE_RET pf_wifi_init(PF_WIFI_CB cb, void *ctx)
{
    THREAD_CFG_T thread_cfg = {
        .stackDepth = PF_WIFI_TASK_STACK_SIZE,
        .priority = THREAD_PRIO_2,
        .thrdname = "pf_wifi",
    };
    OPERATE_RET rt;

    if (sg_initialized || cb == NULL) {
        return sg_initialized ? OPRT_INIT_MORE_THAN_ONCE : OPRT_INVALID_PARM;
    }
    TUYA_CALL_ERR_RETURN(tal_kv_init(&(tal_kv_cfg_t){
        .seed = "pocketfriendwifi",
        .key = "t5aiwifi20260724",
    }));
    TUYA_CALL_ERR_RETURN(tal_mutex_create_init(&sg_wifi_mutex));
    TUYA_CALL_ERR_RETURN(tal_queue_create_init(&sg_wifi_queue,
                                                sizeof(PF_WIFI_COMMAND_T),
                                                PF_WIFI_COMMAND_QUEUE_LENGTH));
    sg_wifi_cb = cb;
    sg_wifi_cb_ctx = ctx;
    TUYA_CALL_ERR_RETURN(tal_wifi_init(pf_wifi_driver_cb));
    TUYA_CALL_ERR_RETURN(tal_wifi_set_work_mode(WWM_STATION));
    rt = tal_thread_create_and_start(&sg_wifi_thread, NULL, NULL,
                                     pf_wifi_worker, NULL, &thread_cfg);
    if (rt != OPRT_OK) {
        return rt;
    }
    sg_initialized = true;
    return OPRT_OK;
}

OPERATE_RET pf_wifi_start(void)
{
    if (!sg_initialized) {
        return OPRT_RESOURCE_NOT_READY;
    }
    pf_wifi_post_command(PF_WIFI_COMMAND_START);
    return OPRT_OK;
}

OPERATE_RET pf_wifi_scan_async(void)
{
    if (!sg_initialized) {
        return OPRT_RESOURCE_NOT_READY;
    }
    pf_wifi_post_command(PF_WIFI_COMMAND_SCAN);
    return OPRT_OK;
}

OPERATE_RET pf_wifi_connect_async(uint8_t ap_index, const char *password)
{
    PF_WIFI_COMMAND_T command;
    size_t length;

    if (!sg_initialized || password == NULL) {
        return OPRT_INVALID_PARM;
    }
    length = strnlen(password, PF_WIFI_PASSWORD_MAX + 1U);
    if (length > PF_WIFI_PASSWORD_MAX) {
        return OPRT_INVALID_PARM;
    }
    memset(&command, 0, sizeof(command));
    command.type = PF_WIFI_COMMAND_CONNECT;
    command.ap_index = ap_index;
    memcpy(command.password, password, length);
    command.password[length] = '\0';
    if (tal_queue_post(sg_wifi_queue, &command, 0) != OPRT_OK) {
        memset(command.password, 0, sizeof(command.password));
        return OPRT_RESOURCE_NOT_READY;
    }
    memset(command.password, 0, sizeof(command.password));
    return OPRT_OK;
}

uint8_t pf_wifi_get_scan_results(PF_WIFI_AP_T *out, uint8_t capacity)
{
    uint8_t count;

    if (out == NULL || capacity == 0U || sg_wifi_mutex == NULL) {
        return 0U;
    }
    tal_mutex_lock(sg_wifi_mutex);
    count = sg_scan_count < capacity ? sg_scan_count : capacity;
    memcpy(out, sg_scan_results, (size_t)count * sizeof(PF_WIFI_AP_T));
    tal_mutex_unlock(sg_wifi_mutex);
    return count;
}

const char *pf_wifi_get_ip(void)
{
    return sg_station_ip;
}

bool pf_wifi_is_connected(void)
{
    return sg_connected;
}
