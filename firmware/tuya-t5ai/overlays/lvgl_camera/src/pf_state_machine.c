#include "pf_state_machine.h"

static void pf_state_clear_session(PF_STATE_CONTEXT_T *ctx)
{
    ctx->local_confirmed = false;
    ctx->peer_confirmed = false;
    ctx->local_captured = false;
    ctx->peer_captured = false;
    ctx->session_id = 0;
}

static void pf_state_enter_idle(PF_STATE_CONTEXT_T *ctx, PF_EFFECTS_T *effects)
{
    pf_state_clear_session(ctx);
    ctx->state = PF_STATE_ONLINE_IDLE;
    *effects |= PF_EFFECT_UI_REFRESH | PF_EFFECT_SAFE_RESET;
}

static void pf_state_check_confirmed(PF_STATE_CONTEXT_T *ctx,
                                     PF_EFFECTS_T *effects)
{
    if (ctx->local_confirmed && ctx->peer_confirmed) {
        ctx->state = PF_STATE_CAPTURE_PREPARE;
        *effects |= PF_EFFECT_SEND_PREPARE;
    }
}

static void pf_state_check_captured(PF_STATE_CONTEXT_T *ctx,
                                    PF_EFFECTS_T *effects)
{
    if (ctx->local_captured && ctx->peer_captured) {
        ctx->state = PF_STATE_SUCCESS;
        *effects |= PF_EFFECT_SEND_SUCCESS |
                    PF_EFFECT_MOTOR_FEEDBACK |
                    PF_EFFECT_UI_REFRESH;
    }
}

void pf_state_init(PF_STATE_CONTEXT_T *ctx)
{
    if (ctx == NULL) {
        return;
    }

    memset(ctx, 0, sizeof(*ctx));
    ctx->state = PF_STATE_BOOT;
}

OPERATE_RET pf_state_dispatch(PF_STATE_CONTEXT_T *ctx,
                              PF_EVENT_E event,
                              PF_EFFECTS_T *effects)
{
    PF_STATE_CONTEXT_T next;
    PF_EFFECTS_T next_effects = PF_EFFECT_NONE;
    bool handled = true;

    if (ctx == NULL || effects == NULL || event > PF_EVENT_EXIT_DND) {
        return OPRT_INVALID_PARM;
    }

    next = *ctx;

    switch (event) {
    case PF_EVENT_STARTED:
        if (next.state != PF_STATE_BOOT) {
            handled = false;
            break;
        }
        next.state = PF_STATE_CONNECTING;
        next_effects = PF_EFFECT_UI_REFRESH;
        break;

    case PF_EVENT_WIFI_CONNECTED:
        if (next.state == PF_STATE_CAMERA_PREVIEW) {
            if (next.camera_return_state != PF_STATE_CONNECTING &&
                next.camera_return_state != PF_STATE_RECONNECTING) {
                handled = false;
                break;
            }
            next.camera_return_state = PF_STATE_ONLINE_IDLE;
            break;
        }
        if (next.state != PF_STATE_CONNECTING &&
            next.state != PF_STATE_RECONNECTING) {
            handled = false;
            break;
        }
        pf_state_enter_idle(&next, &next_effects);
        break;

    case PF_EVENT_WIFI_LOST:
        if (next.state == PF_STATE_BOOT || next.state == PF_STATE_RECONNECTING) {
            handled = false;
            break;
        }
        pf_state_clear_session(&next);
        next.state = PF_STATE_RECONNECTING;
        next_effects = PF_EFFECT_UI_REFRESH | PF_EFFECT_SAFE_RESET;
        break;

    case PF_EVENT_PEER_FOUND:
        if (next.state != PF_STATE_ONLINE_IDLE &&
            next.state != PF_STATE_CAMERA_PREVIEW) {
            handled = false;
            break;
        }
        pf_state_clear_session(&next);
        next.state = PF_STATE_PEER_FOUND;
        next_effects = PF_EFFECT_UI_REFRESH | PF_EFFECT_MOTOR_FEEDBACK;
        break;

    case PF_EVENT_OPEN_CAMERA:
        if (next.state != PF_STATE_ONLINE_IDLE &&
            next.state != PF_STATE_CONNECTING &&
            next.state != PF_STATE_RECONNECTING) {
            handled = false;
            break;
        }
        next.camera_return_state = next.state;
        next.state = PF_STATE_CAMERA_PREVIEW;
        next_effects = PF_EFFECT_UI_REFRESH;
        break;

    case PF_EVENT_CLOSE_CAMERA:
        if (next.state != PF_STATE_CAMERA_PREVIEW) {
            handled = false;
            break;
        }
        next.state = next.camera_return_state;
        next_effects = PF_EFFECT_UI_REFRESH | PF_EFFECT_SAFE_RESET;
        break;

    case PF_EVENT_LOCAL_CONFIRM:
        if (next.state != PF_STATE_PEER_FOUND &&
            next.state != PF_STATE_WAITING_CONFIRM) {
            handled = false;
            break;
        }
        next.state = PF_STATE_WAITING_CONFIRM;
        next.local_confirmed = true;
        next_effects = PF_EFFECT_UI_REFRESH |
                       PF_EFFECT_MOTOR_FEEDBACK |
                       PF_EFFECT_SEND_CONFIRM;
        pf_state_check_confirmed(&next, &next_effects);
        break;

    case PF_EVENT_PEER_CONFIRM:
        if (next.state != PF_STATE_PEER_FOUND &&
            next.state != PF_STATE_WAITING_CONFIRM) {
            handled = false;
            break;
        }
        next.state = PF_STATE_WAITING_CONFIRM;
        next.peer_confirmed = true;
        next_effects = PF_EFFECT_UI_REFRESH;
        pf_state_check_confirmed(&next, &next_effects);
        break;

    case PF_EVENT_LOCAL_CANCEL:
        if (next.state < PF_STATE_PEER_FOUND || next.state > PF_STATE_COUNTDOWN) {
            handled = false;
            break;
        }
        pf_state_enter_idle(&next, &next_effects);
        next_effects |= PF_EFFECT_SEND_CANCEL;
        break;

    case PF_EVENT_PREPARE_REQUEST:
        if (next.state != PF_STATE_WAITING_CONFIRM &&
            next.state != PF_STATE_CAPTURE_PREPARE) {
            handled = false;
            break;
        }
        next.state = PF_STATE_CAPTURE_PREPARE;
        next_effects = PF_EFFECT_UI_REFRESH | PF_EFFECT_SEND_PREPARE_ACK;
        break;

    case PF_EVENT_PREPARE_ACK:
        if (next.state != PF_STATE_CAPTURE_PREPARE) {
            handled = false;
            break;
        }
        next.state = PF_STATE_COUNTDOWN;
        next_effects = PF_EFFECT_UI_REFRESH | PF_EFFECT_SEND_CAPTURE;
        break;

    case PF_EVENT_CAPTURE_COMMAND:
        if (next.state != PF_STATE_WAITING_CONFIRM &&
            next.state != PF_STATE_CAPTURE_PREPARE) {
            handled = false;
            break;
        }
        next.state = PF_STATE_COUNTDOWN;
        next_effects = PF_EFFECT_UI_REFRESH;
        break;

    case PF_EVENT_CAPTURE_OK:
        if (next.state != PF_STATE_CAPTURING) {
            handled = false;
            break;
        }
        next.local_captured = true;
        next.state = PF_STATE_WAITING_RESULT;
        next_effects = PF_EFFECT_UI_REFRESH | PF_EFFECT_SEND_CAPTURED;
        pf_state_check_captured(&next, &next_effects);
        break;

    case PF_EVENT_CAPTURE_FAILED:
        if (next.state != PF_STATE_CAPTURING) {
            handled = false;
            break;
        }
        next.state = PF_STATE_ERROR;
        next_effects = PF_EFFECT_UI_REFRESH |
                       PF_EFFECT_SEND_CAPTURED |
                       PF_EFFECT_SAFE_RESET;
        break;

    case PF_EVENT_PEER_CAPTURED:
        if (next.state != PF_STATE_CAPTURING &&
            next.state != PF_STATE_WAITING_RESULT) {
            handled = false;
            break;
        }
        next.peer_captured = true;
        pf_state_check_captured(&next, &next_effects);
        break;

    case PF_EVENT_PEER_CAPTURE_FAILED:
        if (next.state != PF_STATE_CAPTURING &&
            next.state != PF_STATE_WAITING_RESULT) {
            handled = false;
            break;
        }
        next.state = PF_STATE_ERROR;
        next_effects = PF_EFFECT_UI_REFRESH | PF_EFFECT_SAFE_RESET;
        break;

    case PF_EVENT_SUCCESS:
        if (next.state != PF_STATE_WAITING_RESULT) {
            handled = false;
            break;
        }
        next.state = PF_STATE_SUCCESS;
        next_effects = PF_EFFECT_UI_REFRESH | PF_EFFECT_MOTOR_FEEDBACK;
        break;

    case PF_EVENT_TIMEOUT:
        if (next.state == PF_STATE_COUNTDOWN) {
            next.state = PF_STATE_CAPTURING;
            next_effects = PF_EFFECT_UI_REFRESH | PF_EFFECT_CAPTURE;
        } else if (next.state == PF_STATE_SUCCESS) {
            pf_state_enter_idle(&next, &next_effects);
        } else if (next.state >= PF_STATE_PEER_FOUND &&
                   next.state <= PF_STATE_WAITING_RESULT) {
            next.state = PF_STATE_ERROR;
            next_effects = PF_EFFECT_UI_REFRESH |
                           PF_EFFECT_SEND_CANCEL |
                           PF_EFFECT_SAFE_RESET;
        } else {
            handled = false;
        }
        break;

    case PF_EVENT_ENTER_DND:
        if (next.state != PF_STATE_ONLINE_IDLE &&
            next.state != PF_STATE_CAMERA_PREVIEW &&
            next.state != PF_STATE_PEER_FOUND &&
            next.state != PF_STATE_WAITING_CONFIRM) {
            handled = false;
            break;
        }
        if (next.state == PF_STATE_PEER_FOUND ||
            next.state == PF_STATE_WAITING_CONFIRM) {
            next_effects |= PF_EFFECT_SEND_CANCEL;
        }
        pf_state_clear_session(&next);
        next.state = PF_STATE_DND;
        next_effects |= PF_EFFECT_UI_REFRESH | PF_EFFECT_SAFE_RESET;
        break;

    case PF_EVENT_EXIT_DND:
        if (next.state != PF_STATE_DND) {
            handled = false;
            break;
        }
        pf_state_enter_idle(&next, &next_effects);
        break;

    case PF_EVENT_RESET:
        if (next.state == PF_STATE_BOOT ||
            next.state == PF_STATE_CONNECTING ||
            next.state == PF_STATE_RECONNECTING) {
            handled = false;
            break;
        }
        pf_state_enter_idle(&next, &next_effects);
        break;

    default:
        handled = false;
        break;
    }

    if (!handled) {
        return OPRT_INVALID_PARM;
    }

    *ctx = next;
    *effects = next_effects;
    return OPRT_OK;
}
