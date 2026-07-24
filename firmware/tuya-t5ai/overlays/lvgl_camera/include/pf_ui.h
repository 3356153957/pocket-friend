#ifndef PF_UI_H
#define PF_UI_H

#include "tuya_cloud_types.h"
#include "pf_wifi_config.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    PF_UI_PAGE_IDLE,
    PF_UI_PAGE_PREVIEW,
    PF_UI_PAGE_MATCH,
    PF_UI_PAGE_WAITING,
    PF_UI_PAGE_COUNTDOWN,
    PF_UI_PAGE_RESULT,
    PF_UI_PAGE_DND,
    PF_UI_PAGE_ERROR,
    PF_UI_PAGE_PHOTO_NAME_INPUT,
    PF_UI_PAGE_PINYIN_INPUT,
    PF_UI_PAGE_WIFI_SCAN,
    PF_UI_PAGE_WIFI_PASSWORD,
    PF_UI_PAGE_WIFI_CONNECT,
} PF_UI_PAGE_E;

OPERATE_RET pf_ui_init(void);
void pf_ui_show_page(PF_UI_PAGE_E page);
void pf_ui_set_peer(char peer_id, bool online);
void pf_ui_set_confirmed(bool local, bool peer);
void pf_ui_set_countdown(uint8_t seconds);
void pf_ui_show_preview_countdown(uint8_t seconds);
OPERATE_RET pf_ui_preview_start(uint16_t width, uint16_t height);
void pf_ui_preview_flush(uint16_t width, uint16_t height, uint8_t *yuv);
void pf_ui_preview_stop(void);
OPERATE_RET pf_ui_show_photo(uint16_t width, uint16_t height,
                             uint8_t *jpeg, uint32_t len);
void pf_ui_show_error(const char *message);
void pf_ui_set_wifi_status(bool connected, bool busy);
void pf_ui_wifi_show_scan(void);
void pf_ui_wifi_set_results(const PF_WIFI_AP_T *aps, uint8_t count);
void pf_ui_wifi_show_password(const char *ssid);
void pf_ui_wifi_show_connecting(const char *ssid);
void pf_ui_wifi_show_connected(const char *ip);
void pf_ui_wifi_show_failed(const char *message);
void pf_ui_show_photo_name_input(void);

#ifdef __cplusplus
}
#endif

#endif
