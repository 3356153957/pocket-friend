#ifndef PF_STATE_MACHINE_H
#define PF_STATE_MACHINE_H

#include "tuya_cloud_types.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    PF_STATE_BOOT,
    PF_STATE_CONNECTING,
    PF_STATE_ONLINE_IDLE,
    PF_STATE_CAMERA_PREVIEW,
    PF_STATE_PEER_FOUND,
    PF_STATE_WAITING_CONFIRM,
    PF_STATE_CAPTURE_PREPARE,
    PF_STATE_COUNTDOWN,
    PF_STATE_CAPTURING,
    PF_STATE_WAITING_RESULT,
    PF_STATE_SUCCESS,
    PF_STATE_DND,
    PF_STATE_RECONNECTING,
    PF_STATE_ERROR,
} PF_STATE_E;

typedef enum {
    PF_EVENT_STARTED,
    PF_EVENT_WIFI_CONNECTED,
    PF_EVENT_WIFI_LOST,
    PF_EVENT_PEER_FOUND,
    PF_EVENT_OPEN_CAMERA,
    PF_EVENT_CLOSE_CAMERA,
    PF_EVENT_LOCAL_CONFIRM,
    PF_EVENT_PEER_CONFIRM,
    PF_EVENT_LOCAL_CANCEL,
    PF_EVENT_PREPARE_REQUEST,
    PF_EVENT_PREPARE_ACK,
    PF_EVENT_CAPTURE_COMMAND,
    PF_EVENT_CAPTURE_OK,
    PF_EVENT_CAPTURE_FAILED,
    PF_EVENT_PEER_CAPTURED,
    PF_EVENT_PEER_CAPTURE_FAILED,
    PF_EVENT_SUCCESS,
    PF_EVENT_TIMEOUT,
    PF_EVENT_ENTER_DND,
    PF_EVENT_EXIT_DND,
    PF_EVENT_RESET,
    PF_EVENT_COUNT,
} PF_EVENT_E;

typedef uint32_t PF_EFFECTS_T;

#define PF_EFFECT_NONE             0U
#define PF_EFFECT_UI_REFRESH       (1U << 0)
#define PF_EFFECT_MOTOR_FEEDBACK   (1U << 1)
#define PF_EFFECT_SEND_CONFIRM     (1U << 2)
#define PF_EFFECT_SEND_CANCEL      (1U << 3)
#define PF_EFFECT_SEND_PREPARE     (1U << 4)
#define PF_EFFECT_SEND_PREPARE_ACK (1U << 5)
#define PF_EFFECT_SEND_CAPTURE     (1U << 6)
#define PF_EFFECT_CAPTURE          (1U << 7)
#define PF_EFFECT_SEND_CAPTURED    (1U << 8)
#define PF_EFFECT_SEND_SUCCESS     (1U << 9)
#define PF_EFFECT_SAFE_RESET       (1U << 10)

typedef struct {
    PF_STATE_E state;
    PF_STATE_E camera_return_state;
    bool local_confirmed;
    bool peer_confirmed;
    bool local_captured;
    bool peer_captured;
    uint32_t session_id;
} PF_STATE_CONTEXT_T;

void pf_state_init(PF_STATE_CONTEXT_T *ctx);
OPERATE_RET pf_state_dispatch(PF_STATE_CONTEXT_T *ctx,
                              PF_EVENT_E event,
                              PF_EFFECTS_T *effects);

#ifdef __cplusplus
}
#endif

#endif
