#ifndef PF_WIFI_CONFIG_H
#define PF_WIFI_CONFIG_H

#include "tuya_cloud_types.h"

#ifdef __cplusplus
extern "C" {
#endif

#define PF_WIFI_MAX_APS 20U
#define PF_WIFI_SSID_MAX 32U
#define PF_WIFI_PASSWORD_MAX 64U

typedef struct {
    char ssid[PF_WIFI_SSID_MAX + 1U];
    int8_t rssi;
    uint8_t security;
} PF_WIFI_AP_T;

typedef enum {
    PF_WIFI_EVENT_UNCONFIGURED,
    PF_WIFI_EVENT_SCAN_STARTED,
    PF_WIFI_EVENT_SCAN_COMPLETE,
    PF_WIFI_EVENT_SCAN_FAILED,
    PF_WIFI_EVENT_CONNECTING,
    PF_WIFI_EVENT_CONNECTED,
    PF_WIFI_EVENT_CONNECT_FAILED,
    PF_WIFI_EVENT_DISCONNECTED,
    PF_WIFI_EVENT_SAVE_FAILED,
} PF_WIFI_EVENT_E;

typedef void (*PF_WIFI_CB)(PF_WIFI_EVENT_E event, void *ctx);

OPERATE_RET pf_wifi_init(PF_WIFI_CB cb, void *ctx);
OPERATE_RET pf_wifi_start(void);
OPERATE_RET pf_wifi_scan_async(void);
OPERATE_RET pf_wifi_connect_async(uint8_t ap_index, const char *password);
uint8_t pf_wifi_get_scan_results(PF_WIFI_AP_T *out, uint8_t capacity);
const char *pf_wifi_get_ip(void);
bool pf_wifi_is_connected(void);

#ifdef __cplusplus
}
#endif

#endif
