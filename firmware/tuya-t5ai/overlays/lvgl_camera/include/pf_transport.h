#ifndef PF_TRANSPORT_H
#define PF_TRANSPORT_H

#include "pf_protocol.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    PF_TRANSPORT_WIFI_CONNECTED,
    PF_TRANSPORT_WIFI_LOST,
    PF_TRANSPORT_PEER_FOUND,
    PF_TRANSPORT_PEER_LOST,
    PF_TRANSPORT_MESSAGE,
} PF_TRANSPORT_EVENT_E;

typedef void (*PF_TRANSPORT_CB)(PF_TRANSPORT_EVENT_E event,
                                const PF_MESSAGE_T *message,
                                void *ctx);

OPERATE_RET pf_transport_init(PF_TRANSPORT_CB cb, void *ctx);
OPERATE_RET pf_transport_start(void);
OPERATE_RET pf_transport_send(PF_MESSAGE_TYPE_E type,
                              uint32_t session_id,
                              int32_t result,
                              bool critical);
void pf_transport_stop(void);

#ifdef __cplusplus
}
#endif

#endif
