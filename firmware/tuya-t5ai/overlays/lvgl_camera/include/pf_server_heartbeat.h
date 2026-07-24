#ifndef PF_SERVER_HEARTBEAT_H
#define PF_SERVER_HEARTBEAT_H

#include "tuya_cloud_types.h"

#ifdef __cplusplus
extern "C" {
#endif

OPERATE_RET pf_server_heartbeat_init(void);
void pf_server_heartbeat_network_up(void);
void pf_server_heartbeat_network_down(void);
OPERATE_RET pf_server_photo_upload(const uint8_t *jpeg, uint32_t len,
                                   const char *filename);

#ifdef __cplusplus
}
#endif

#endif
