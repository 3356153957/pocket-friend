#ifndef PF_INPUT_H
#define PF_INPUT_H

#include "tuya_cloud_types.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    PF_INPUT_CONFIRM,
    PF_INPUT_CANCEL,
    PF_INPUT_COMPLETE,
    PF_INPUT_TOGGLE_DND,
    PF_INPUT_OPEN_CAMERA,
    PF_INPUT_CLOSE_CAMERA,
    PF_INPUT_RETRY,
} PF_INPUT_ACTION_E;

typedef enum {
    PF_INPUT_MODE_IDLE,
    PF_INPUT_MODE_PREVIEW,
    PF_INPUT_MODE_MATCH,
    PF_INPUT_MODE_WAITING,
    PF_INPUT_MODE_RESULT,
    PF_INPUT_MODE_LOCKED,
} PF_INPUT_MODE_E;

typedef void (*PF_INPUT_CB)(PF_INPUT_ACTION_E action, void *ctx);

OPERATE_RET pf_input_init(PF_INPUT_CB cb, void *ctx);
void pf_input_post_from_ui(PF_INPUT_ACTION_E action);
void pf_input_set_mode(PF_INPUT_MODE_E mode);

#ifdef __cplusplus
}
#endif

#endif
