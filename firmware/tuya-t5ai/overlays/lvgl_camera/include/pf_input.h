#ifndef PF_INPUT_H
#define PF_INPUT_H

#include "tuya_cloud_types.h"
#include "pf_wifi_config.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    PF_INPUT_CONFIRM,
    PF_INPUT_CANCEL,
    PF_INPUT_COMPLETE,
    PF_INPUT_TOGGLE_DND,
    PF_INPUT_OPEN_CAMERA,
    PF_INPUT_CAPTURE_PHOTO,
    PF_INPUT_CLOSE_CAMERA,
    PF_INPUT_RETRY,
    PF_INPUT_OPEN_PINYIN,
    PF_INPUT_PINYIN_BACK,
    PF_INPUT_OPEN_WIFI,
    PF_INPUT_WIFI_SCAN,
    PF_INPUT_WIFI_SELECT,
    PF_INPUT_WIFI_CONNECT,
    PF_INPUT_WIFI_BACK,
    PF_INPUT_WIFI_RETRY,
} PF_INPUT_ACTION_E;

typedef enum {
    PF_INPUT_MODE_IDLE,
    PF_INPUT_MODE_PREVIEW,
    PF_INPUT_MODE_MATCH,
    PF_INPUT_MODE_WAITING,
    PF_INPUT_MODE_RESULT,
    PF_INPUT_MODE_LOCKED,
} PF_INPUT_MODE_E;

typedef struct {
    PF_INPUT_ACTION_E action;
    uint8_t index;
    char text[PF_WIFI_PASSWORD_MAX + 1U];
} PF_INPUT_EVENT_T;

typedef void (*PF_INPUT_CB)(const PF_INPUT_EVENT_T *event, void *ctx);

OPERATE_RET pf_input_init(PF_INPUT_CB cb, void *ctx);
void pf_input_post_from_ui(PF_INPUT_ACTION_E action);
void pf_input_post_wifi_from_ui(PF_INPUT_ACTION_E action,
                                uint8_t index, const char *text);
void pf_input_set_mode(PF_INPUT_MODE_E mode);

#ifdef __cplusplus
}
#endif

#endif
