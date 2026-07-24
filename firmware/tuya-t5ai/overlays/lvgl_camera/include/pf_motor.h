#ifndef PF_MOTOR_H
#define PF_MOTOR_H

#include "tuya_cloud_types.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    PF_MOTOR_PATTERN_PEER_FOUND,
    PF_MOTOR_PATTERN_LOCAL_CONFIRMED,
    PF_MOTOR_PATTERN_WAITING,
    PF_MOTOR_PATTERN_BOTH_CONFIRMED,
    PF_MOTOR_PATTERN_SUCCESS,
    PF_MOTOR_PATTERN_ERROR,
} PF_MOTOR_PATTERN_E;

OPERATE_RET pf_motor_init(void);
OPERATE_RET pf_motor_play(PF_MOTOR_PATTERN_E pattern);
OPERATE_RET pf_motor_stop(void);

#ifdef __cplusplus
}
#endif

#endif
