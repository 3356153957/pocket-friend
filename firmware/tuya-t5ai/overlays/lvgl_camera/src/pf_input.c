#include "pf_input.h"

#include "board_com_api.h"
#include "tdl_button_manage.h"

static PF_INPUT_CB sg_input_cb = NULL;
static void *sg_input_ctx = NULL;
static volatile PF_INPUT_MODE_E sg_input_mode = PF_INPUT_MODE_LOCKED;
static TDL_BUTTON_HANDLE sg_button_handle = NULL;
static bool sg_input_initialized = false;

static void pf_input_emit(PF_INPUT_ACTION_E action)
{
    if (sg_input_cb != NULL && action <= PF_INPUT_RETRY) {
        sg_input_cb(action, sg_input_ctx);
    }
}

static bool pf_input_single_click_action(PF_INPUT_ACTION_E *action)
{
    switch (sg_input_mode) {
    case PF_INPUT_MODE_IDLE:
        *action = PF_INPUT_OPEN_CAMERA;
        return true;
    case PF_INPUT_MODE_PREVIEW:
        *action = PF_INPUT_CLOSE_CAMERA;
        return true;
    case PF_INPUT_MODE_MATCH:
        *action = PF_INPUT_CONFIRM;
        return true;
    case PF_INPUT_MODE_WAITING:
        *action = PF_INPUT_CANCEL;
        return true;
    case PF_INPUT_MODE_RESULT:
        *action = PF_INPUT_COMPLETE;
        return true;
    case PF_INPUT_MODE_LOCKED:
    default:
        return false;
    }
}

static void pf_input_button_cb(char *name, TDL_BUTTON_TOUCH_EVENT_E event,
                               void *arg)
{
    PF_INPUT_ACTION_E action;

    (void)name;
    (void)arg;
    if (event == TDL_BUTTON_LONG_PRESS_START) {
        pf_input_emit(PF_INPUT_TOGGLE_DND);
    } else if (event == TDL_BUTTON_PRESS_SINGLE_CLICK &&
               pf_input_single_click_action(&action)) {
        pf_input_emit(action);
    }
}

OPERATE_RET pf_input_init(PF_INPUT_CB cb, void *ctx)
{
    OPERATE_RET rt;
    TDL_BUTTON_CFG_T button_cfg = {0};

    if (cb == NULL) {
        return OPRT_INVALID_PARM;
    }
    if (sg_input_initialized) {
        return OPRT_INIT_MORE_THAN_ONCE;
    }

    button_cfg.long_start_valid_time = 1500;
    button_cfg.long_keep_timer = 1000;
    button_cfg.button_debounce_time = 50;

    rt = tdl_button_create(BUTTON_NAME, &button_cfg, &sg_button_handle);
    if (rt != OPRT_OK) {
        return rt;
    }

    sg_input_cb = cb;
    sg_input_ctx = ctx;
    sg_input_mode = PF_INPUT_MODE_LOCKED;
    tdl_button_event_register(sg_button_handle,
                              TDL_BUTTON_PRESS_SINGLE_CLICK,
                              pf_input_button_cb);
    tdl_button_event_register(sg_button_handle,
                              TDL_BUTTON_LONG_PRESS_START,
                              pf_input_button_cb);
    sg_input_initialized = true;
    return OPRT_OK;
}

void pf_input_post_from_ui(PF_INPUT_ACTION_E action)
{
    pf_input_emit(action);
}

void pf_input_set_mode(PF_INPUT_MODE_E mode)
{
    if (mode <= PF_INPUT_MODE_LOCKED) {
        sg_input_mode = mode;
    }
}
