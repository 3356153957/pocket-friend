#ifndef PF_DEMO_CONFIG_H
#define PF_DEMO_CONFIG_H

#include "pf_demo_runtime_config.h"

#define PF_PROTOCOL_VERSION        1U
#define PF_UDP_PORT                37800U
#define PF_HEARTBEAT_MS            1000U
#define PF_PEER_TIMEOUT_MS         3000U
#define PF_CONFIRM_TIMEOUT_MS      10000U
#define PF_CAPTURE_DELAY_MS        3000U
#define PF_CAPTURE_TIMEOUT_MS      3000U
#define PF_CRITICAL_RETRY_COUNT    3U
#define PF_CRITICAL_RETRY_GAP_MS   100U

#endif
