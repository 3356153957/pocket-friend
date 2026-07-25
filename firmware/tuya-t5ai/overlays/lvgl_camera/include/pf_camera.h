#ifndef PF_CAMERA_H
#define PF_CAMERA_H

#include "tuya_cloud_types.h"

#ifdef __cplusplus
extern "C" {
#endif

#define PF_CAMERA_WIDTH  480U
#define PF_CAMERA_HEIGHT 480U

typedef void (*PF_CAMERA_FRAME_CB)(uint8_t *yuv_data,
                                   uint16_t width,
                                   uint16_t height);

OPERATE_RET pf_camera_init(void);
void pf_camera_preview_enable(bool enable);
void pf_camera_set_frame_cb(PF_CAMERA_FRAME_CB cb);
void pf_camera_prepare_capture_stream(void);
bool pf_camera_capture_stream_ready(void);
OPERATE_RET pf_camera_capture_jpeg(uint8_t **data, uint32_t *len);
void pf_camera_release_jpeg(uint8_t *data);

#ifdef __cplusplus
}
#endif

#endif
