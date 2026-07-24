#include "pf_protocol.h"

#include "pf_demo_config.h"

#define PF_WIRE_MAGIC 0x5046444DU

static void pf_put_u32(uint8_t *out, uint32_t value)
{
    out[0] = (uint8_t)(value >> 24);
    out[1] = (uint8_t)(value >> 16);
    out[2] = (uint8_t)(value >> 8);
    out[3] = (uint8_t)value;
}

static uint32_t pf_get_u32(const uint8_t *data)
{
    return ((uint32_t)data[0] << 24) |
           ((uint32_t)data[1] << 16) |
           ((uint32_t)data[2] << 8) |
           (uint32_t)data[3];
}

static bool pf_protocol_type_valid(uint8_t type)
{
    return type >= PF_MSG_HELLO && type <= PF_MSG_RESET;
}

static bool pf_protocol_device_valid(char device_id)
{
    return device_id == 'A' || device_id == 'B';
}

OPERATE_RET pf_protocol_encode(const PF_MESSAGE_T *message,
                               uint8_t out[PF_WIRE_PACKET_SIZE])
{
    if (message == NULL || out == NULL ||
        message->version != PF_PROTOCOL_VERSION ||
        !pf_protocol_type_valid(message->type) ||
        !pf_protocol_device_valid(message->device_id)) {
        return OPRT_INVALID_PARM;
    }

    memset(out, 0, PF_WIRE_PACKET_SIZE);
    pf_put_u32(out, PF_WIRE_MAGIC);
    out[4] = message->version;
    out[5] = message->type;
    out[6] = (uint8_t)message->device_id;
    out[7] = message->state;
    pf_put_u32(out + 8, message->session_id);
    pf_put_u32(out + 12, message->message_id);
    pf_put_u32(out + 16, message->sequence);
    pf_put_u32(out + 20, message->timestamp_ms);
    pf_put_u32(out + 24, (uint32_t)message->result);

    return OPRT_OK;
}

OPERATE_RET pf_protocol_decode(const uint8_t *data, uint32_t len,
                               PF_MESSAGE_T *message)
{
    if (data == NULL || message == NULL || len != PF_WIRE_PACKET_SIZE) {
        return OPRT_INVALID_PARM;
    }

    if (pf_get_u32(data) != PF_WIRE_MAGIC ||
        data[4] != PF_PROTOCOL_VERSION ||
        !pf_protocol_type_valid(data[5]) ||
        !pf_protocol_device_valid((char)data[6])) {
        return OPRT_INVALID_PARM;
    }

    memset(message, 0, sizeof(*message));
    message->version = data[4];
    message->type = data[5];
    message->device_id = (char)data[6];
    message->state = data[7];
    message->session_id = pf_get_u32(data + 8);
    message->message_id = pf_get_u32(data + 12);
    message->sequence = pf_get_u32(data + 16);
    message->timestamp_ms = pf_get_u32(data + 20);
    message->result = (int32_t)pf_get_u32(data + 24);

    return OPRT_OK;
}
