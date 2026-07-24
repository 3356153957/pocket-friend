#include "pf_app.h"

#include "pf_camera.h"
#include "pf_demo_config.h"
#include "pf_input.h"
#include "pf_motor.h"
#include "pf_state_machine.h"
#include "pf_transport.h"
#include "pf_ui.h"
#include "tal_api.h"

#define PF_APP_QUEUE_LENGTH 16
#define PF_APP_TASK_STACK_SIZE 6144U
#define PF_CAPTURE_TASK_STACK_SIZE 4096U
#define PF_RESULT_DISPLAY_MS 5000U

typedef enum {
    PF_APP_EVENT_INPUT,
    PF_APP_EVENT_TRANSPORT,
    PF_APP_EVENT_TIMER,
    PF_APP_EVENT_CAPTURE_DONE,
} PF_APP_EVENT_TYPE_E;

typedef struct {
    PF_APP_EVENT_TYPE_E type;
    union {
        PF_INPUT_ACTION_E input;
        struct {
            PF_TRANSPORT_EVENT_E event;
            PF_MESSAGE_T message;
        } transport;
        PF_EVENT_E timer_event;
        OPERATE_RET capture_result;
    } data;
} PF_APP_EVENT_T;

static QUEUE_HANDLE sg_app_queue;
static SEM_HANDLE sg_capture_request;
static THREAD_HANDLE sg_app_thread;
static THREAD_HANDLE sg_capture_thread;
static TIMER_ID sg_flow_timer;
static PF_STATE_CONTEXT_T sg_state;
static uint8_t sg_countdown_remaining;
static uint8_t *sg_photo_jpeg;
static uint32_t sg_photo_len;
static OPERATE_RET sg_last_capture_result = OPRT_OK;
static bool sg_app_started;

static void pf_post_event(const PF_APP_EVENT_T *event)
{
    if (sg_app_queue == NULL ||
        tal_queue_post(sg_app_queue, (void *)event, 0) != OPRT_OK) {
        PR_ERR("[app] event queue full");
    }
}

static void pf_input_cb(PF_INPUT_ACTION_E action, void *ctx)
{
    PF_APP_EVENT_T event = {.type = PF_APP_EVENT_INPUT};
    (void)ctx;
    event.data.input = action;
    pf_post_event(&event);
}

static void pf_transport_cb(PF_TRANSPORT_EVENT_E transport_event,
                            const PF_MESSAGE_T *message, void *ctx)
{
    PF_APP_EVENT_T event = {.type = PF_APP_EVENT_TRANSPORT};
    (void)ctx;
    event.data.transport.event = transport_event;
    if (message != NULL) {
        event.data.transport.message = *message;
    }
    pf_post_event(&event);
}

static void pf_flow_timer_cb(TIMER_ID timer_id, void *arg)
{
    PF_APP_EVENT_T event = {.type = PF_APP_EVENT_TIMER};
    (void)timer_id;
    (void)arg;
    event.data.timer_event = PF_EVENT_TIMEOUT;
    pf_post_event(&event);
}

static void pf_capture_task(void *arg)
{
    (void)arg;
    for (;;) {
        PF_APP_EVENT_T event = {.type = PF_APP_EVENT_CAPTURE_DONE};
        uint8_t *jpeg = NULL;
        uint32_t len = 0;

        if (tal_semaphore_wait(sg_capture_request, SEM_WAIT_FOREVER) != OPRT_OK) {
            continue;
        }
        event.data.capture_result = pf_camera_capture_jpeg(&jpeg, &len);
        if (event.data.capture_result == OPRT_OK) {
            sg_photo_jpeg = jpeg;
            sg_photo_len = len;
        }
        if (tal_queue_post(sg_app_queue, &event, 0) != OPRT_OK) {
            pf_camera_release_jpeg(jpeg);
            sg_photo_jpeg = NULL;
            sg_photo_len = 0;
        }
    }
}

static void pf_release_photo(void)
{
    pf_camera_release_jpeg(sg_photo_jpeg);
    sg_photo_jpeg = NULL;
    sg_photo_len = 0;
}

static void pf_stop_preview(void)
{
    pf_camera_preview_enable(false);
    pf_ui_preview_stop();
}

static void pf_safe_reset(void)
{
    tal_sw_timer_stop(sg_flow_timer);
    sg_countdown_remaining = 0;
    (void)pf_motor_stop();
    pf_stop_preview();
    pf_release_photo();
}

static void pf_start_countdown(void)
{
    tal_sw_timer_stop(sg_flow_timer);
    sg_countdown_remaining = (uint8_t)(PF_CAPTURE_DELAY_MS / 1000U);
    pf_ui_set_countdown(sg_countdown_remaining);
    tal_sw_timer_start(sg_flow_timer, 1000U, TAL_TIMER_CYCLE);
}

static void pf_refresh_ui(PF_STATE_E previous_state)
{
    if (previous_state == PF_STATE_CAMERA_PREVIEW &&
        sg_state.state != PF_STATE_CAMERA_PREVIEW) {
        pf_stop_preview();
    }

    switch (sg_state.state) {
    case PF_STATE_ONLINE_IDLE:
        pf_input_set_mode(PF_INPUT_MODE_IDLE);
        pf_ui_show_page(PF_UI_PAGE_IDLE);
        break;
    case PF_STATE_CAMERA_PREVIEW:
        pf_input_set_mode(PF_INPUT_MODE_PREVIEW);
        if (pf_ui_preview_start(PF_CAMERA_WIDTH, PF_CAMERA_HEIGHT) == OPRT_OK) {
            pf_camera_preview_enable(true);
        }
        break;
    case PF_STATE_PEER_FOUND:
        pf_input_set_mode(PF_INPUT_MODE_MATCH);
        pf_ui_set_peer(PF_PEER_ID, true);
        pf_ui_set_confirmed(false, false);
        pf_ui_show_page(PF_UI_PAGE_MATCH);
        tal_sw_timer_start(sg_flow_timer, PF_CONFIRM_TIMEOUT_MS,
                           TAL_TIMER_ONCE);
        break;
    case PF_STATE_WAITING_CONFIRM:
    case PF_STATE_CAPTURE_PREPARE:
        pf_input_set_mode(PF_INPUT_MODE_WAITING);
        pf_ui_set_confirmed(sg_state.local_confirmed,
                            sg_state.peer_confirmed);
        pf_ui_show_page(PF_UI_PAGE_WAITING);
        if (sg_state.state == PF_STATE_CAPTURE_PREPARE) {
            tal_sw_timer_stop(sg_flow_timer);
        }
        break;
    case PF_STATE_COUNTDOWN:
        pf_input_set_mode(PF_INPUT_MODE_LOCKED);
        pf_ui_show_page(PF_UI_PAGE_COUNTDOWN);
        pf_start_countdown();
        break;
    case PF_STATE_CAPTURING:
    case PF_STATE_WAITING_RESULT:
        pf_input_set_mode(PF_INPUT_MODE_LOCKED);
        pf_ui_show_page(PF_UI_PAGE_COUNTDOWN);
        break;
    case PF_STATE_SUCCESS:
        pf_input_set_mode(PF_INPUT_MODE_RESULT);
        if (pf_ui_show_photo(PF_CAMERA_WIDTH, PF_CAMERA_HEIGHT,
                             sg_photo_jpeg, sg_photo_len) != OPRT_OK) {
            pf_ui_show_error("Photo display failed");
        }
        pf_release_photo();
        tal_sw_timer_start(sg_flow_timer, PF_RESULT_DISPLAY_MS,
                           TAL_TIMER_ONCE);
        break;
    case PF_STATE_DND:
        pf_input_set_mode(PF_INPUT_MODE_LOCKED);
        pf_ui_show_page(PF_UI_PAGE_DND);
        break;
    case PF_STATE_ERROR:
        pf_input_set_mode(PF_INPUT_MODE_RESULT);
        pf_ui_show_error("Capture failed. Try again.");
        (void)pf_motor_play(PF_MOTOR_PATTERN_ERROR);
        break;
    case PF_STATE_CONNECTING:
    case PF_STATE_RECONNECTING:
    default:
        pf_input_set_mode(PF_INPUT_MODE_LOCKED);
        pf_ui_show_page(PF_UI_PAGE_IDLE);
        break;
    }
}

static void pf_play_feedback(void)
{
    PF_MOTOR_PATTERN_E pattern = PF_MOTOR_PATTERN_LOCAL_CONFIRMED;

    if (sg_state.state == PF_STATE_PEER_FOUND) {
        pattern = PF_MOTOR_PATTERN_PEER_FOUND;
    } else if (sg_state.state == PF_STATE_CAPTURE_PREPARE) {
        pattern = PF_MOTOR_PATTERN_BOTH_CONFIRMED;
    } else if (sg_state.state == PF_STATE_SUCCESS) {
        pattern = PF_MOTOR_PATTERN_SUCCESS;
    }
    (void)pf_motor_play(pattern);
}

static void pf_execute_effects(PF_EFFECTS_T effects, PF_STATE_E previous_state,
                               uint32_t session_id)
{
    if ((effects & PF_EFFECT_SAFE_RESET) != 0U) {
        pf_safe_reset();
    }
    if ((effects & PF_EFFECT_SEND_CONFIRM) != 0U) {
        (void)pf_transport_send(PF_MSG_CONFIRM, session_id, 0, true);
    }
    if ((effects & PF_EFFECT_SEND_CANCEL) != 0U) {
        (void)pf_transport_send(PF_MSG_CANCEL, session_id, 0, true);
    }
    if ((effects & PF_EFFECT_SEND_PREPARE) != 0U && PF_DEVICE_ID == 'A') {
        (void)pf_transport_send(PF_MSG_CAPTURE_PREPARE, session_id, 0, true);
    }
    if ((effects & PF_EFFECT_SEND_PREPARE_ACK) != 0U && PF_DEVICE_ID == 'B') {
        (void)pf_transport_send(PF_MSG_PREPARE_ACK, session_id, 0, true);
    }
    if ((effects & PF_EFFECT_SEND_CAPTURE) != 0U && PF_DEVICE_ID == 'A') {
        (void)pf_transport_send(PF_MSG_CAPTURE, session_id, 0, true);
    }
    if ((effects & PF_EFFECT_SEND_CAPTURED) != 0U) {
        (void)pf_transport_send(PF_MSG_CAPTURED, session_id,
                                sg_last_capture_result, true);
    }
    if ((effects & PF_EFFECT_SEND_SUCCESS) != 0U && PF_DEVICE_ID == 'A') {
        (void)pf_transport_send(PF_MSG_SUCCESS, session_id, 0, true);
    }
    if ((effects & PF_EFFECT_CAPTURE) != 0U) {
        tal_semaphore_post(sg_capture_request);
    }
    if ((effects & PF_EFFECT_MOTOR_FEEDBACK) != 0U) {
        pf_play_feedback();
    }
    if ((effects & PF_EFFECT_UI_REFRESH) != 0U) {
        pf_refresh_ui(previous_state);
    }
}

static void pf_dispatch(PF_EVENT_E state_event)
{
    PF_EFFECTS_T effects;
    PF_STATE_E previous_state = sg_state.state;
    uint32_t session_id = sg_state.session_id;

    if (pf_state_dispatch(&sg_state, state_event, &effects) != OPRT_OK) {
        return;
    }
    if (sg_state.session_id != 0U) {
        session_id = sg_state.session_id;
    }
    pf_execute_effects(effects, previous_state, session_id);
}

static void pf_handle_input(PF_INPUT_ACTION_E input)
{
    switch (input) {
    case PF_INPUT_CONFIRM:
        if (PF_DEVICE_ID == 'A' && sg_state.session_id == 0U) {
            sg_state.session_id = (uint32_t)tal_system_get_millisecond();
            if (sg_state.session_id == 0U) {
                sg_state.session_id = 1U;
            }
        }
        pf_dispatch(PF_EVENT_LOCAL_CONFIRM);
        break;
    case PF_INPUT_CANCEL:
        pf_dispatch(PF_EVENT_LOCAL_CANCEL);
        break;
    case PF_INPUT_TOGGLE_DND:
        pf_dispatch(sg_state.state == PF_STATE_DND ?
                    PF_EVENT_EXIT_DND : PF_EVENT_ENTER_DND);
        break;
    case PF_INPUT_OPEN_CAMERA:
        pf_dispatch(PF_EVENT_OPEN_CAMERA);
        break;
    case PF_INPUT_CLOSE_CAMERA:
        pf_dispatch(PF_EVENT_CLOSE_CAMERA);
        break;
    case PF_INPUT_COMPLETE:
    case PF_INPUT_RETRY:
        pf_dispatch(PF_EVENT_RESET);
        break;
    default:
        break;
    }
}

static bool pf_message_session_valid(const PF_MESSAGE_T *message)
{
    return message->type == PF_MSG_CONFIRM ||
           sg_state.session_id == 0U ||
           message->session_id == sg_state.session_id;
}

static void pf_handle_message(const PF_MESSAGE_T *message)
{
    if (!pf_message_session_valid(message)) {
        return;
    }
    if (sg_state.session_id == 0U && message->session_id != 0U) {
        sg_state.session_id = message->session_id;
    }

    switch ((PF_MESSAGE_TYPE_E)message->type) {
    case PF_MSG_CONFIRM:
        pf_dispatch(PF_EVENT_PEER_CONFIRM);
        break;
    case PF_MSG_CANCEL:
    case PF_MSG_RESET:
        pf_dispatch(PF_EVENT_RESET);
        break;
    case PF_MSG_CAPTURE_PREPARE:
        if (PF_DEVICE_ID == 'B') {
            pf_dispatch(PF_EVENT_PREPARE_REQUEST);
        }
        break;
    case PF_MSG_PREPARE_ACK:
        if (PF_DEVICE_ID == 'A') {
            pf_dispatch(PF_EVENT_PREPARE_ACK);
        }
        break;
    case PF_MSG_CAPTURE:
        if (PF_DEVICE_ID == 'B') {
            pf_dispatch(PF_EVENT_CAPTURE_COMMAND);
        }
        break;
    case PF_MSG_CAPTURED:
        if (PF_DEVICE_ID == 'A') {
            pf_dispatch(message->result == OPRT_OK ?
                        PF_EVENT_PEER_CAPTURED :
                        PF_EVENT_PEER_CAPTURE_FAILED);
        }
        break;
    case PF_MSG_SUCCESS:
        if (PF_DEVICE_ID == 'B') {
            pf_dispatch(PF_EVENT_SUCCESS);
        }
        break;
    default:
        break;
    }
}

static void pf_handle_transport(const PF_APP_EVENT_T *event)
{
    switch (event->data.transport.event) {
    case PF_TRANSPORT_WIFI_CONNECTED:
        pf_dispatch(PF_EVENT_WIFI_CONNECTED);
        break;
    case PF_TRANSPORT_WIFI_LOST:
        pf_dispatch(PF_EVENT_WIFI_LOST);
        break;
    case PF_TRANSPORT_PEER_FOUND:
        pf_dispatch(PF_EVENT_PEER_FOUND);
        break;
    case PF_TRANSPORT_PEER_LOST:
        if (sg_state.state != PF_STATE_DND &&
            ((sg_state.state >= PF_STATE_PEER_FOUND &&
              sg_state.state <= PF_STATE_SUCCESS) ||
             sg_state.state == PF_STATE_ERROR)) {
            pf_dispatch(PF_EVENT_RESET);
        }
        break;
    case PF_TRANSPORT_MESSAGE:
        pf_handle_message(&event->data.transport.message);
        break;
    default:
        break;
    }
}

static void pf_handle_timer(PF_EVENT_E timer_event)
{
    if (timer_event != PF_EVENT_TIMEOUT) {
        return;
    }
    if (sg_state.state == PF_STATE_COUNTDOWN && sg_countdown_remaining > 0U) {
        --sg_countdown_remaining;
        if (sg_countdown_remaining > 0U) {
            pf_ui_set_countdown(sg_countdown_remaining);
            if (sg_countdown_remaining == 1U) {
                (void)pf_motor_play(PF_MOTOR_PATTERN_LOCAL_CONFIRMED);
            }
            return;
        }
        tal_sw_timer_stop(sg_flow_timer);
        (void)pf_motor_stop();
    }
    pf_dispatch(PF_EVENT_TIMEOUT);
}

static void pf_app_task(void *arg)
{
    PF_APP_EVENT_T event;
    (void)arg;

    pf_state_init(&sg_state);
    pf_dispatch(PF_EVENT_STARTED);
    for (;;) {
        if (tal_queue_fetch(sg_app_queue, &event, QUEUE_WAIT_FOREVER) != OPRT_OK) {
            continue;
        }
        switch (event.type) {
        case PF_APP_EVENT_INPUT:
            pf_handle_input(event.data.input);
            break;
        case PF_APP_EVENT_TRANSPORT:
            pf_handle_transport(&event);
            break;
        case PF_APP_EVENT_TIMER:
            pf_handle_timer(event.data.timer_event);
            break;
        case PF_APP_EVENT_CAPTURE_DONE:
            sg_last_capture_result = event.data.capture_result;
            pf_dispatch(event.data.capture_result == OPRT_OK ?
                        PF_EVENT_CAPTURE_OK : PF_EVENT_CAPTURE_FAILED);
            break;
        default:
            break;
        }
    }
}

OPERATE_RET pf_app_start(void)
{
    OPERATE_RET rt;
    THREAD_CFG_T app_cfg = {
        .stackDepth = PF_APP_TASK_STACK_SIZE,
        .priority = THREAD_PRIO_2,
        .thrdname = "pf_app",
    };
    THREAD_CFG_T capture_cfg = {
        .stackDepth = PF_CAPTURE_TASK_STACK_SIZE,
        .priority = THREAD_PRIO_3,
        .thrdname = "pf_capture",
    };

    if (sg_app_started) {
        return OPRT_INIT_MORE_THAN_ONCE;
    }
    TUYA_CALL_ERR_RETURN(tal_queue_create_init(&sg_app_queue,
                                                sizeof(PF_APP_EVENT_T),
                                                PF_APP_QUEUE_LENGTH));
    TUYA_CALL_ERR_RETURN(tal_semaphore_create_init(&sg_capture_request, 0, 1));
    TUYA_CALL_ERR_RETURN(tal_sw_timer_create(pf_flow_timer_cb, NULL,
                                             &sg_flow_timer));
    TUYA_CALL_ERR_RETURN(pf_motor_init());
    TUYA_CALL_ERR_RETURN(pf_camera_init());
    TUYA_CALL_ERR_RETURN(pf_input_init(pf_input_cb, NULL));
    TUYA_CALL_ERR_RETURN(pf_ui_init());
    TUYA_CALL_ERR_RETURN(pf_transport_init(pf_transport_cb, NULL));

    rt = tal_thread_create_and_start(&sg_capture_thread, NULL, NULL,
                                     pf_capture_task, NULL, &capture_cfg);
    if (rt != OPRT_OK) {
        return rt;
    }
    rt = tal_thread_create_and_start(&sg_app_thread, NULL, NULL,
                                     pf_app_task, NULL, &app_cfg);
    if (rt != OPRT_OK) {
        return rt;
    }

    sg_app_started = true;
    return pf_transport_start();
}
