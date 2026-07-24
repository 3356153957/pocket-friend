#ifndef PF_UI_H
#define PF_UI_H

#include "tuya_cloud_types.h"

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
} PF_UI_PAGE_E;

OPERATE_RET pf_ui_init(void);
void pf_ui_show_page(PF_UI_PAGE_E page);
void pf_ui_set_peer(char peer_id, bool online);
void pf_ui_set_confirmed(bool local, bool peer);
void pf_ui_set_countdown(uint8_t seconds);
OPERATE_RET pf_ui_preview_start(uint16_t width, uint16_t height);
void pf_ui_preview_flush(uint16_t width, uint16_t height, uint8_t *yuv);
void pf_ui_preview_stop(void);
OPERATE_RET pf_ui_show_photo(uint16_t width, uint16_t height,
                             uint8_t *jpeg, uint32_t len);
void pf_ui_show_error(const char *message);

#ifdef __cplusplus
}
#endif

#endif
