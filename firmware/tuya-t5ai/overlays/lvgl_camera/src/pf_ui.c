#include "pf_ui.h"

#include <stdint.h>

#include "board_com_api.h"
#include "lv_vendor.h"
#include "lvgl.h"
#include "pf_camera.h"
#include "pf_input.h"
#include "tal_api.h"
#include "tal_image.h"

#define PF_UI_WIDTH          320
#define PF_UI_HEIGHT         480
#define PF_UI_TOUCH_TARGET   64
#define PF_UI_PRIMARY_WIDTH  272
#define PF_UI_PRIMARY_HEIGHT 72
#define PF_UI_PAGE_COUNT     ((uint8_t)PF_UI_PAGE_WIFI_CONNECT + 1U)

#define PF_UI_COLOR_BG       0x111827U
#define PF_UI_COLOR_SURFACE  0x1F2937U
#define PF_UI_COLOR_PRIMARY  0x2563EBU
#define PF_UI_COLOR_ACCENT   0xF97316U
#define PF_UI_COLOR_TEXT     0xF8FAFCU
#define PF_UI_COLOR_MUTED    0xCBD5E1U
#define PF_UI_COLOR_SUCCESS  0x22C55EU
#define PF_UI_COLOR_ERROR    0xDC2626U

typedef struct {
    lv_obj_t *pages[PF_UI_PAGE_COUNT];
    lv_obj_t *preview_canvas;
    lv_obj_t *result_image;
    lv_obj_t *peer_label;
    lv_obj_t *match_status_label;
    lv_obj_t *waiting_status_label;
    lv_obj_t *countdown_label;
    lv_obj_t *error_label;
    lv_obj_t *wifi_status_label;
    lv_obj_t *wifi_list;
    lv_obj_t *wifi_scan_status;
    lv_obj_t *wifi_ssid_label;
    lv_obj_t *wifi_password;
    lv_obj_t *wifi_keyboard;
    lv_obj_t *wifi_connect_label;
    lv_obj_t *wifi_retry_button;
} PF_UI_OBJECTS_T;

static PF_UI_OBJECTS_T sg_ui;
static MUTEX_HANDLE sg_preview_mutex = NULL;
static uint8_t *sg_preview_buffer = NULL;
static uint8_t *sg_result_buffer = NULL;
static lv_image_dsc_t sg_result_descriptor;
static bool sg_ui_initialized = false;

static void pf_ui_wifi_ap_cb(lv_event_t *event)
{
    uint8_t index = (uint8_t)(uintptr_t)lv_event_get_user_data(event);
    pf_input_post_wifi_from_ui(PF_INPUT_WIFI_SELECT, index, NULL);
}

static void pf_ui_wifi_connect_cb(lv_event_t *event)
{
    const char *password = lv_textarea_get_text(sg_ui.wifi_password);
    (void)event;
    pf_input_post_wifi_from_ui(PF_INPUT_WIFI_CONNECT, 0U, password);
    lv_textarea_set_text(sg_ui.wifi_password, "");
}

static void pf_ui_wifi_visibility_cb(lv_event_t *event)
{
    bool hidden = lv_textarea_get_password_mode(sg_ui.wifi_password);
    (void)event;
    lv_textarea_set_password_mode(sg_ui.wifi_password, !hidden);
}

static void pf_ui_button_cb(lv_event_t *event)
{
    PF_INPUT_ACTION_E action =
        (PF_INPUT_ACTION_E)(uintptr_t)lv_event_get_user_data(event);

    pf_input_post_from_ui(action);
}

static lv_obj_t *pf_ui_create_page(const char *title)
{
    lv_obj_t *page = lv_obj_create(NULL);
    lv_obj_t *label = lv_label_create(page);

    lv_obj_set_size(page, PF_UI_WIDTH, PF_UI_HEIGHT);
    lv_obj_set_style_bg_color(page, lv_color_hex(PF_UI_COLOR_BG), 0);
    lv_obj_set_style_border_width(page, 0, 0);
    lv_obj_set_style_pad_all(page, 0, 0);
    lv_obj_clear_flag(page, LV_OBJ_FLAG_SCROLLABLE);

    lv_label_set_text(label, title);
    lv_obj_set_style_text_color(label, lv_color_hex(PF_UI_COLOR_TEXT), 0);
    lv_obj_set_style_text_font(label, &lv_font_montserrat_24, 0);
    lv_obj_align(label, LV_ALIGN_TOP_MID, 0, 28);
    return page;
}

static lv_obj_t *pf_ui_create_label(lv_obj_t *parent, const char *text,
                                    lv_align_t align, int32_t x, int32_t y)
{
    lv_obj_t *label = lv_label_create(parent);

    lv_label_set_text(label, text);
    lv_label_set_long_mode(label, LV_LABEL_LONG_WRAP);
    lv_obj_set_width(label, PF_UI_PRIMARY_WIDTH);
    lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_text_color(label, lv_color_hex(PF_UI_COLOR_MUTED), 0);
    lv_obj_align(label, align, x, y);
    return label;
}

static lv_obj_t *pf_ui_create_button(lv_obj_t *parent, const char *text,
                                     PF_INPUT_ACTION_E action,
                                     uint32_t color, bool compact)
{
    lv_obj_t *button = lv_btn_create(parent);
    lv_obj_t *label = lv_label_create(button);

    if (compact) {
        lv_obj_set_size(button, PF_UI_TOUCH_TARGET, PF_UI_TOUCH_TARGET);
    } else {
        lv_obj_set_size(button, PF_UI_PRIMARY_WIDTH, PF_UI_PRIMARY_HEIGHT);
    }
    lv_obj_set_style_bg_color(button, lv_color_hex(color), 0);
    lv_obj_set_style_bg_opa(button, LV_OPA_70,
                            LV_PART_MAIN | LV_STATE_PRESSED);
    lv_obj_set_style_radius(button, 8, 0);
    lv_obj_set_style_shadow_width(button, 0, 0);
    lv_obj_add_event_cb(button, pf_ui_button_cb, LV_EVENT_CLICKED,
                        (void *)(uintptr_t)action);

    lv_label_set_text(label, text);
    lv_obj_set_style_text_color(label, lv_color_hex(PF_UI_COLOR_TEXT), 0);
    lv_obj_center(label);
    return button;
}

static void pf_ui_create_idle_page(void)
{
    lv_obj_t *button;

    sg_ui.pages[PF_UI_PAGE_IDLE] = pf_ui_create_page("Pocket Friend");
    pf_ui_create_label(sg_ui.pages[PF_UI_PAGE_IDLE], "Waiting for a friend",
                       LV_ALIGN_CENTER, 0, -40);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_IDLE], "Camera",
                                 PF_INPUT_OPEN_CAMERA,
                                 PF_UI_COLOR_PRIMARY, false);
    lv_obj_align(button, LV_ALIGN_BOTTOM_MID, 0, -24);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_IDLE],
                                 LV_SYMBOL_WIFI, PF_INPUT_OPEN_WIFI,
                                 PF_UI_COLOR_SURFACE, true);
    lv_obj_align(button, LV_ALIGN_TOP_RIGHT, -8, 8);
    sg_ui.wifi_status_label = lv_label_create(sg_ui.pages[PF_UI_PAGE_IDLE]);
    lv_label_set_text(sg_ui.wifi_status_label, LV_SYMBOL_CLOSE);
    lv_obj_set_style_text_color(sg_ui.wifi_status_label,
                                lv_color_hex(PF_UI_COLOR_MUTED), 0);
    lv_obj_align(sg_ui.wifi_status_label, LV_ALIGN_TOP_RIGHT, -76, 28);
}

static void pf_ui_create_wifi_scan_page(void)
{
    lv_obj_t *button;

    sg_ui.pages[PF_UI_PAGE_WIFI_SCAN] = pf_ui_create_page("Wi-Fi");
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_WIFI_SCAN],
                                 LV_SYMBOL_LEFT, PF_INPUT_WIFI_BACK,
                                 PF_UI_COLOR_SURFACE, true);
    lv_obj_align(button, LV_ALIGN_TOP_LEFT, 8, 8);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_WIFI_SCAN],
                                 LV_SYMBOL_REFRESH, PF_INPUT_WIFI_SCAN,
                                 PF_UI_COLOR_PRIMARY, true);
    lv_obj_align(button, LV_ALIGN_TOP_RIGHT, -8, 8);
    sg_ui.wifi_scan_status =
        pf_ui_create_label(sg_ui.pages[PF_UI_PAGE_WIFI_SCAN],
                           "Scanning...", LV_ALIGN_TOP_MID, 0, 78);
    sg_ui.wifi_list = lv_list_create(sg_ui.pages[PF_UI_PAGE_WIFI_SCAN]);
    lv_obj_set_size(sg_ui.wifi_list, 288, 330);
    lv_obj_align(sg_ui.wifi_list, LV_ALIGN_BOTTOM_MID, 0, -12);
}

static void pf_ui_create_wifi_password_page(void)
{
    lv_obj_t *button;

    sg_ui.pages[PF_UI_PAGE_WIFI_PASSWORD] = pf_ui_create_page("Password");
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_WIFI_PASSWORD],
                                 LV_SYMBOL_LEFT, PF_INPUT_WIFI_BACK,
                                 PF_UI_COLOR_SURFACE, true);
    lv_obj_align(button, LV_ALIGN_TOP_LEFT, 8, 8);
    sg_ui.wifi_ssid_label =
        pf_ui_create_label(sg_ui.pages[PF_UI_PAGE_WIFI_PASSWORD], "",
                           LV_ALIGN_TOP_MID, 0, 72);
    sg_ui.wifi_password =
        lv_textarea_create(sg_ui.pages[PF_UI_PAGE_WIFI_PASSWORD]);
    lv_obj_set_size(sg_ui.wifi_password, 230, 52);
    lv_obj_align(sg_ui.wifi_password, LV_ALIGN_TOP_LEFT, 16, 112);
    lv_textarea_set_one_line(sg_ui.wifi_password, true);
    lv_textarea_set_password_mode(sg_ui.wifi_password, true);
    lv_textarea_set_max_length(sg_ui.wifi_password, 63U);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_WIFI_PASSWORD],
                                 LV_SYMBOL_EYE_OPEN, PF_INPUT_WIFI_BACK,
                                 PF_UI_COLOR_SURFACE, true);
    lv_obj_align(button, LV_ALIGN_TOP_RIGHT, -8, 106);
    lv_obj_remove_event_cb(button, pf_ui_button_cb);
    lv_obj_add_event_cb(button, pf_ui_wifi_visibility_cb, LV_EVENT_CLICKED, NULL);
    sg_ui.wifi_keyboard =
        lv_keyboard_create(sg_ui.pages[PF_UI_PAGE_WIFI_PASSWORD]);
    lv_obj_set_size(sg_ui.wifi_keyboard, 304, 230);
    lv_obj_align(sg_ui.wifi_keyboard, LV_ALIGN_BOTTOM_MID, 0, -8);
    lv_keyboard_set_textarea(sg_ui.wifi_keyboard, sg_ui.wifi_password);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_WIFI_PASSWORD],
                                 "Connect", PF_INPUT_WIFI_BACK,
                                 PF_UI_COLOR_PRIMARY, true);
    lv_obj_set_size(button, 112, 48);
    lv_obj_align(button, LV_ALIGN_TOP_MID, 0, 174);
    lv_obj_remove_event_cb(button, pf_ui_button_cb);
    lv_obj_add_event_cb(button, pf_ui_wifi_connect_cb, LV_EVENT_CLICKED, NULL);
}

static void pf_ui_create_wifi_connect_page(void)
{
    lv_obj_t *button;

    sg_ui.pages[PF_UI_PAGE_WIFI_CONNECT] = pf_ui_create_page("Wi-Fi");
    sg_ui.wifi_connect_label =
        pf_ui_create_label(sg_ui.pages[PF_UI_PAGE_WIFI_CONNECT],
                           "Connecting...", LV_ALIGN_CENTER, 0, -24);
    sg_ui.wifi_retry_button =
        pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_WIFI_CONNECT], "Retry",
                            PF_INPUT_WIFI_RETRY, PF_UI_COLOR_PRIMARY, false);
    lv_obj_align(sg_ui.wifi_retry_button, LV_ALIGN_BOTTOM_MID, 0, -24);
    lv_obj_add_flag(sg_ui.wifi_retry_button, LV_OBJ_FLAG_HIDDEN);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_WIFI_CONNECT],
                                 LV_SYMBOL_LEFT, PF_INPUT_WIFI_BACK,
                                 PF_UI_COLOR_SURFACE, true);
    lv_obj_align(button, LV_ALIGN_TOP_LEFT, 8, 8);
}

static void pf_ui_create_preview_page(void)
{
    lv_obj_t *button;

    sg_ui.pages[PF_UI_PAGE_PREVIEW] = lv_obj_create(NULL);
    lv_obj_set_size(sg_ui.pages[PF_UI_PAGE_PREVIEW], PF_UI_WIDTH, PF_UI_HEIGHT);
    lv_obj_set_style_bg_color(sg_ui.pages[PF_UI_PAGE_PREVIEW],
                              lv_color_black(), 0);
    lv_obj_set_style_border_width(sg_ui.pages[PF_UI_PAGE_PREVIEW], 0, 0);
    lv_obj_set_style_pad_all(sg_ui.pages[PF_UI_PAGE_PREVIEW], 0, 0);
    lv_obj_clear_flag(sg_ui.pages[PF_UI_PAGE_PREVIEW], LV_OBJ_FLAG_SCROLLABLE);

    sg_ui.preview_canvas = lv_canvas_create(sg_ui.pages[PF_UI_PAGE_PREVIEW]);
    lv_obj_add_flag(sg_ui.preview_canvas, LV_OBJ_FLAG_HIDDEN);
    lv_obj_align(sg_ui.preview_canvas, LV_ALIGN_CENTER, 0, 0);

    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_PREVIEW],
                                 LV_SYMBOL_LEFT, PF_INPUT_CLOSE_CAMERA,
                                 PF_UI_COLOR_SURFACE, true);
    lv_obj_align(button, LV_ALIGN_TOP_LEFT, 8, 8);
}

static void pf_ui_create_match_page(void)
{
    lv_obj_t *button;

    sg_ui.pages[PF_UI_PAGE_MATCH] = pf_ui_create_page("Friend found");
    sg_ui.peer_label = pf_ui_create_label(sg_ui.pages[PF_UI_PAGE_MATCH],
                                          "Friend -- offline",
                                          LV_ALIGN_CENTER, 0, -72);
    sg_ui.match_status_label =
        pf_ui_create_label(sg_ui.pages[PF_UI_PAGE_MATCH], "Ready to connect",
                           LV_ALIGN_CENTER, 0, -8);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_MATCH], "Confirm",
                                 PF_INPUT_CONFIRM, PF_UI_COLOR_ACCENT, false);
    lv_obj_align(button, LV_ALIGN_BOTTOM_MID, 0, -24);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_MATCH], LV_SYMBOL_CLOSE,
                                 PF_INPUT_CANCEL, PF_UI_COLOR_SURFACE, true);
    lv_obj_align(button, LV_ALIGN_TOP_LEFT, 8, 8);
}

static void pf_ui_create_waiting_page(void)
{
    lv_obj_t *button;

    sg_ui.pages[PF_UI_PAGE_WAITING] = pf_ui_create_page("Almost ready");
    sg_ui.waiting_status_label =
        pf_ui_create_label(sg_ui.pages[PF_UI_PAGE_WAITING],
                           "You: waiting\nFriend: waiting",
                           LV_ALIGN_CENTER, 0, -16);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_WAITING], "Cancel",
                                 PF_INPUT_CANCEL, PF_UI_COLOR_SURFACE, false);
    lv_obj_align(button, LV_ALIGN_BOTTOM_MID, 0, -24);
}

static void pf_ui_create_countdown_page(void)
{
    sg_ui.pages[PF_UI_PAGE_COUNTDOWN] = pf_ui_create_page("Photo in");
    sg_ui.countdown_label =
        pf_ui_create_label(sg_ui.pages[PF_UI_PAGE_COUNTDOWN], "3",
                           LV_ALIGN_CENTER, 0, 0);
    lv_obj_set_style_text_color(sg_ui.countdown_label,
                                lv_color_hex(PF_UI_COLOR_ACCENT), 0);
    lv_obj_set_style_text_font(sg_ui.countdown_label,
                               &lv_font_montserrat_24, 0);
}

static void pf_ui_create_result_page(void)
{
    lv_obj_t *button;

    sg_ui.pages[PF_UI_PAGE_RESULT] = lv_obj_create(NULL);
    lv_obj_set_size(sg_ui.pages[PF_UI_PAGE_RESULT], PF_UI_WIDTH, PF_UI_HEIGHT);
    lv_obj_set_style_bg_color(sg_ui.pages[PF_UI_PAGE_RESULT],
                              lv_color_black(), 0);
    lv_obj_set_style_border_width(sg_ui.pages[PF_UI_PAGE_RESULT], 0, 0);
    lv_obj_set_style_pad_all(sg_ui.pages[PF_UI_PAGE_RESULT], 0, 0);
    lv_obj_clear_flag(sg_ui.pages[PF_UI_PAGE_RESULT], LV_OBJ_FLAG_SCROLLABLE);

    sg_ui.result_image = lv_image_create(sg_ui.pages[PF_UI_PAGE_RESULT]);
    lv_obj_set_size(sg_ui.result_image, PF_UI_WIDTH, PF_UI_HEIGHT);
    lv_obj_center(sg_ui.result_image);

    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_RESULT], "Done",
                                 PF_INPUT_COMPLETE, PF_UI_COLOR_SUCCESS, false);
    lv_obj_align(button, LV_ALIGN_BOTTOM_MID, 0, -24);
}

static void pf_ui_create_dnd_page(void)
{
    lv_obj_t *button;

    sg_ui.pages[PF_UI_PAGE_DND] = pf_ui_create_page("Do not disturb");
    pf_ui_create_label(sg_ui.pages[PF_UI_PAGE_DND], "Pocket Friend is paused",
                       LV_ALIGN_CENTER, 0, -24);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_DND], "Resume",
                                 PF_INPUT_TOGGLE_DND,
                                 PF_UI_COLOR_PRIMARY, false);
    lv_obj_align(button, LV_ALIGN_BOTTOM_MID, 0, -24);
}

static void pf_ui_create_error_page(void)
{
    lv_obj_t *button;

    sg_ui.pages[PF_UI_PAGE_ERROR] = pf_ui_create_page("Something went wrong");
    sg_ui.error_label =
        pf_ui_create_label(sg_ui.pages[PF_UI_PAGE_ERROR], "Please try again",
                           LV_ALIGN_CENTER, 0, -24);
    lv_obj_set_style_text_color(sg_ui.error_label,
                                lv_color_hex(PF_UI_COLOR_ERROR), 0);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_ERROR], "Retry",
                                 PF_INPUT_RETRY, PF_UI_COLOR_PRIMARY, false);
    lv_obj_align(button, LV_ALIGN_BOTTOM_MID, 0, -24);
}

OPERATE_RET pf_ui_init(void)
{
    OPERATE_RET rt;

    if (sg_ui_initialized) {
        return OPRT_INIT_MORE_THAN_ONCE;
    }
    rt = tal_mutex_create_init(&sg_preview_mutex);
    if (rt != OPRT_OK) {
        return rt;
    }

    lv_vendor_init(DISPLAY_NAME);
    lv_vendor_start(THREAD_PRIO_1, 1024U * 8U);
    lv_vendor_disp_lock();
    pf_ui_create_idle_page();
    pf_ui_create_preview_page();
    pf_ui_create_match_page();
    pf_ui_create_waiting_page();
    pf_ui_create_countdown_page();
    pf_ui_create_result_page();
    pf_ui_create_dnd_page();
    pf_ui_create_error_page();
    pf_ui_create_wifi_scan_page();
    pf_ui_create_wifi_password_page();
    pf_ui_create_wifi_connect_page();
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_IDLE]);
    lv_vendor_disp_unlock();

    sg_ui_initialized = true;
    PR_NOTICE("[ui] ready 320x480");
    return OPRT_OK;
}

void pf_ui_show_page(PF_UI_PAGE_E page)
{
    if (!sg_ui_initialized || page >= PF_UI_PAGE_COUNT) {
        return;
    }
    lv_vendor_disp_lock();
    lv_screen_load(sg_ui.pages[page]);
    lv_vendor_disp_unlock();
}

void pf_ui_set_peer(char peer_id, bool online)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_label_set_text_fmt(sg_ui.peer_label, "Friend %c  %s", peer_id,
                          online ? "online" : "offline");
    lv_vendor_disp_unlock();
}

void pf_ui_set_confirmed(bool local, bool peer)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_label_set_text(sg_ui.match_status_label,
                      local ? "Waiting for friend" : "Ready to connect");
    lv_label_set_text_fmt(sg_ui.waiting_status_label,
                          "You: %s\nFriend: %s",
                          local ? "ready" : "waiting",
                          peer ? "ready" : "waiting");
    lv_vendor_disp_unlock();
}

void pf_ui_set_countdown(uint8_t seconds)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_label_set_text_fmt(sg_ui.countdown_label, "%u", seconds);
    lv_vendor_disp_unlock();
}

static void pf_ui_camera_frame_cb(uint8_t *yuv, uint16_t width,
                                  uint16_t height)
{
    pf_ui_preview_flush(width, height, yuv);
}

OPERATE_RET pf_ui_preview_start(uint16_t width, uint16_t height)
{
    uint32_t buffer_size;
    uint8_t *buffer;

    if (!sg_ui_initialized || width == 0U || height == 0U ||
        width > PF_CAMERA_WIDTH || height > PF_CAMERA_HEIGHT) {
        return OPRT_INVALID_PARM;
    }

    buffer_size = (uint32_t)width * height * 2U;
    buffer = tal_psram_calloc(1, buffer_size);
    if (buffer == NULL) {
        return OPRT_MALLOC_FAILED;
    }

    tal_mutex_lock(sg_preview_mutex);
    if (sg_preview_buffer != NULL) {
        tal_mutex_unlock(sg_preview_mutex);
        tal_psram_free(buffer);
        return OPRT_INIT_MORE_THAN_ONCE;
    }
    sg_preview_buffer = buffer;
    lv_vendor_disp_lock();
    lv_canvas_set_buffer(sg_ui.preview_canvas, sg_preview_buffer,
                         width, height, LV_COLOR_FORMAT_RGB565);
    lv_obj_set_size(sg_ui.preview_canvas, width, height);
    lv_obj_align(sg_ui.preview_canvas, LV_ALIGN_CENTER, 0, 0);
    lv_obj_clear_flag(sg_ui.preview_canvas, LV_OBJ_FLAG_HIDDEN);
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_PREVIEW]);
    lv_vendor_disp_unlock();
    pf_camera_set_frame_cb(pf_ui_camera_frame_cb);
    tal_mutex_unlock(sg_preview_mutex);
    return OPRT_OK;
}

void pf_ui_preview_flush(uint16_t width, uint16_t height, uint8_t *yuv)
{
    TAL_IMAGE_YUV422_TO_RGB_T conversion;

    if (!sg_ui_initialized || yuv == NULL) {
        return;
    }

    tal_mutex_lock(sg_preview_mutex);
    if (sg_preview_buffer == NULL) {
        tal_mutex_unlock(sg_preview_mutex);
        return;
    }

    memset(&conversion, 0, sizeof(conversion));
    conversion.in_buf = yuv;
    conversion.in_width = width;
    conversion.in_height = height;
    conversion.out_buf = sg_preview_buffer;
    conversion.out_width = width;
    conversion.out_height = height;
    if (tal_image_convert_yuv422_to_rgb565(&conversion) == OPRT_OK) {
        lv_vendor_disp_lock();
        lv_obj_invalidate(sg_ui.preview_canvas);
        lv_vendor_disp_unlock();
    }
    tal_mutex_unlock(sg_preview_mutex);
}

void pf_ui_preview_stop(void)
{
    uint8_t *buffer;

    if (!sg_ui_initialized) {
        return;
    }
    pf_camera_preview_enable(false);
    pf_camera_set_frame_cb(NULL);

    tal_mutex_lock(sg_preview_mutex);
    buffer = sg_preview_buffer;
    sg_preview_buffer = NULL;
    lv_vendor_disp_lock();
    lv_obj_add_flag(sg_ui.preview_canvas, LV_OBJ_FLAG_HIDDEN);
    lv_vendor_disp_unlock();
    tal_mutex_unlock(sg_preview_mutex);
    tal_psram_free(buffer);
}

OPERATE_RET pf_ui_show_photo(uint16_t width, uint16_t height,
                             uint8_t *jpeg, uint32_t len)
{
    OPERATE_RET rt;
    uint32_t buffer_size;
    uint8_t *buffer;
    uint8_t *old_buffer;
    TAL_IMAGE_JPEG_OUTPUT_T output;

    if (!sg_ui_initialized || jpeg == NULL || len == 0U ||
        width == 0U || height == 0U ||
        width > PF_CAMERA_WIDTH || height > PF_CAMERA_HEIGHT) {
        return OPRT_INVALID_PARM;
    }

    buffer_size = (uint32_t)width * height * 2U;
    buffer = tal_psram_malloc(buffer_size);
    if (buffer == NULL) {
        return OPRT_MALLOC_FAILED;
    }
    memset(&output, 0, sizeof(output));
    output.out_buf = buffer;
    output.out_buf_size = buffer_size;
    output.out_width = width;
    output.out_height = height;
    rt = tal_image_jpeg_decode_rgb565(jpeg, len, &output);
    if (rt != OPRT_OK) {
        tal_psram_free(buffer);
        return rt;
    }

    lv_vendor_disp_lock();
    old_buffer = sg_result_buffer;
    sg_result_buffer = buffer;
    memset(&sg_result_descriptor, 0, sizeof(sg_result_descriptor));
    sg_result_descriptor.header.cf = LV_COLOR_FORMAT_RGB565;
    sg_result_descriptor.header.w = width;
    sg_result_descriptor.header.h = height;
    sg_result_descriptor.data = sg_result_buffer;
    sg_result_descriptor.data_size = buffer_size;
    lv_image_set_src(sg_ui.result_image, &sg_result_descriptor);
    lv_image_set_inner_align(sg_ui.result_image, LV_IMAGE_ALIGN_CENTER);
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_RESULT]);
    lv_vendor_disp_unlock();
    tal_psram_free(old_buffer);
    return OPRT_OK;
}

void pf_ui_show_error(const char *message)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_label_set_text(sg_ui.error_label,
                      message != NULL ? message : "Please try again");
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_ERROR]);
    lv_vendor_disp_unlock();
}

void pf_ui_set_wifi_status(bool connected, bool busy)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_label_set_text(sg_ui.wifi_status_label,
                      connected ? LV_SYMBOL_OK :
                      (busy ? LV_SYMBOL_REFRESH : LV_SYMBOL_CLOSE));
    lv_obj_set_style_text_color(
        sg_ui.wifi_status_label,
        lv_color_hex(connected ? PF_UI_COLOR_SUCCESS : PF_UI_COLOR_MUTED), 0);
    lv_vendor_disp_unlock();
}

void pf_ui_wifi_show_scan(void)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_obj_clean(sg_ui.wifi_list);
    lv_label_set_text(sg_ui.wifi_scan_status, "Scanning...");
    lv_obj_clear_flag(sg_ui.wifi_scan_status, LV_OBJ_FLAG_HIDDEN);
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_WIFI_SCAN]);
    lv_vendor_disp_unlock();
}

void pf_ui_wifi_set_results(const PF_WIFI_AP_T *aps, uint8_t count)
{
    uint8_t i;

    if (!sg_ui_initialized || (aps == NULL && count > 0U)) {
        return;
    }
    lv_vendor_disp_lock();
    lv_obj_clean(sg_ui.wifi_list);
    if (count == 0U) {
        lv_label_set_text(sg_ui.wifi_scan_status, "No networks found");
        lv_obj_clear_flag(sg_ui.wifi_scan_status, LV_OBJ_FLAG_HIDDEN);
    } else {
        lv_obj_add_flag(sg_ui.wifi_scan_status, LV_OBJ_FLAG_HIDDEN);
        for (i = 0U; i < count; ++i) {
            char label[64];
            lv_obj_t *button;

            snprintf(label, sizeof(label), "%s  %d dBm%s", aps[i].ssid,
                     aps[i].rssi, aps[i].security == 0U ? "" : "  *");
            button = lv_list_add_button(sg_ui.wifi_list, LV_SYMBOL_WIFI, label);
            lv_obj_add_event_cb(button, pf_ui_wifi_ap_cb, LV_EVENT_CLICKED,
                                (void *)(uintptr_t)i);
        }
    }
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_WIFI_SCAN]);
    lv_vendor_disp_unlock();
}

void pf_ui_wifi_show_password(const char *ssid)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_label_set_text(sg_ui.wifi_ssid_label, ssid != NULL ? ssid : "Wi-Fi");
    lv_textarea_set_text(sg_ui.wifi_password, "");
    lv_textarea_set_password_mode(sg_ui.wifi_password, true);
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_WIFI_PASSWORD]);
    lv_vendor_disp_unlock();
}

void pf_ui_wifi_show_connecting(const char *ssid)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_label_set_text_fmt(sg_ui.wifi_connect_label, "Connecting to\n%s",
                          ssid != NULL ? ssid : "Wi-Fi");
    lv_obj_add_flag(sg_ui.wifi_retry_button, LV_OBJ_FLAG_HIDDEN);
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_WIFI_CONNECT]);
    lv_vendor_disp_unlock();
}

void pf_ui_wifi_show_connected(const char *ip)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_label_set_text_fmt(sg_ui.wifi_connect_label, "Connected\n%s",
                          ip != NULL ? ip : "");
    lv_obj_add_flag(sg_ui.wifi_retry_button, LV_OBJ_FLAG_HIDDEN);
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_WIFI_CONNECT]);
    lv_vendor_disp_unlock();
}

void pf_ui_wifi_show_failed(const char *message)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_label_set_text(sg_ui.wifi_connect_label,
                      message != NULL ? message : "Unable to connect");
    lv_obj_clear_flag(sg_ui.wifi_retry_button, LV_OBJ_FLAG_HIDDEN);
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_WIFI_CONNECT]);
    lv_vendor_disp_unlock();
}
