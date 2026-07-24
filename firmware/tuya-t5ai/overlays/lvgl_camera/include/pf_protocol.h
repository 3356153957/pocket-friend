#ifndef PF_PROTOCOL_H
#define PF_PROTOCOL_H

#include "tuya_cloud_types.h"

#ifdef __cplusplus
extern "C" {
#endif

#define PF_WIRE_PACKET_SIZE 32U

typedef enum {
    PF_MSG_HELLO = 1,
    PF_MSG_CONFIRM,
    PF_MSG_CANCEL,
    PF_MSG_CAPTURE_PREPARE,
    PF_MSG_PREPARE_ACK,
    PF_MSG_CAPTURE,
    PF_MSG_CAPTURED,
    PF_MSG_SUCCESS,
    PF_MSG_RESET,
} PF_MESSAGE_TYPE_E;

typedef struct {
    uint8_t version;
    uint8_t type;
    char device_id;
    uint8_t state;
    uint32_t session_id;
    uint32_t message_id;
    uint32_t sequence;
    uint32_t timestamp_ms;
    int32_t result;
} PF_MESSAGE_T;

OPERATE_RET pf_protocol_encode(const PF_MESSAGE_T *message,
                               uint8_t out[PF_WIRE_PACKET_SIZE]);
OPERATE_RET pf_protocol_decode(const uint8_t *data, uint32_t len,
                               PF_MESSAGE_T *message);

#ifdef __cplusplus
}
#endif

#endif
