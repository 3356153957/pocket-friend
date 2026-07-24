#include "pf_motor.h"

#include "tal_api.h"
#include "tkl_gpio.h"

#define PF_MOTOR_IN1_PIN          TUYA_GPIO_NUM_6
#define PF_MOTOR_IN2_PIN          TUYA_GPIO_NUM_7
#define PF_MOTOR_QUEUE_LENGTH     4
#define PF_MOTOR_TASK_STACK_SIZE  2048
#define PF_MOTOR_SLEEP_SLICE_MS   20U

typedef struct {
    PF_MOTOR_PATTERN_E pattern;
    uint32_t generation;
} PF_MOTOR_COMMAND_T;

static QUEUE_HANDLE sg_motor_queue = NULL;
static THREAD_HANDLE sg_motor_thread = NULL;
static volatile uint32_t sg_motor_generation = 0;
static bool sg_motor_initialized = false;

static OPERATE_RET pf_motor_write_stopped(void)
{
    OPERATE_RET in1_rt = tkl_gpio_write(PF_MOTOR_IN1_PIN, TUYA_GPIO_LEVEL_LOW);
    OPERATE_RET in2_rt = tkl_gpio_write(PF_MOTOR_IN2_PIN, TUYA_GPIO_LEVEL_LOW);

    return in1_rt != OPRT_OK ? in1_rt : in2_rt;
}

static OPERATE_RET pf_motor_write_running(void)
{
    OPERATE_RET rt = tkl_gpio_write(PF_MOTOR_IN2_PIN, TUYA_GPIO_LEVEL_LOW);

    if (rt != OPRT_OK) {
        return rt;
    }

    return tkl_gpio_write(PF_MOTOR_IN1_PIN, TUYA_GPIO_LEVEL_HIGH);
}

static bool pf_motor_sleep_interruptible(uint32_t duration_ms,
                                         uint32_t generation)
{
    uint32_t remaining = duration_ms;

    while (remaining > 0U && generation == sg_motor_generation) {
        uint32_t slice = remaining > PF_MOTOR_SLEEP_SLICE_MS ?
                         PF_MOTOR_SLEEP_SLICE_MS : remaining;
        tal_system_sleep(slice);
        remaining -= slice;
    }

    return generation == sg_motor_generation;
}

static bool pf_motor_pulse(uint32_t on_ms, uint32_t off_ms,
                           uint32_t generation)
{
    if (generation != sg_motor_generation) {
        return false;
    }

    if (pf_motor_write_running() != OPRT_OK) {
        pf_motor_write_stopped();
        return false;
    }

    if (!pf_motor_sleep_interruptible(on_ms, generation)) {
        pf_motor_write_stopped();
        return false;
    }

    pf_motor_write_stopped();
    return pf_motor_sleep_interruptible(off_ms, generation);
}

static void pf_motor_run_pattern(const PF_MOTOR_COMMAND_T *command)
{
    uint32_t generation = command->generation;

    switch (command->pattern) {
    case PF_MOTOR_PATTERN_PEER_FOUND:
        pf_motor_pulse(100U, 80U, generation);
        pf_motor_pulse(100U, 0U, generation);
        break;
    case PF_MOTOR_PATTERN_LOCAL_CONFIRMED:
        pf_motor_pulse(160U, 0U, generation);
        break;
    case PF_MOTOR_PATTERN_WAITING:
        while (generation == sg_motor_generation) {
            if (!pf_motor_pulse(60U, 940U, generation)) {
                break;
            }
        }
        break;
    case PF_MOTOR_PATTERN_BOTH_CONFIRMED:
        pf_motor_pulse(100U, 80U, generation);
        pf_motor_pulse(100U, 80U, generation);
        pf_motor_pulse(100U, 0U, generation);
        break;
    case PF_MOTOR_PATTERN_SUCCESS:
        pf_motor_pulse(600U, 0U, generation);
        break;
    case PF_MOTOR_PATTERN_ERROR:
        pf_motor_pulse(250U, 100U, generation);
        pf_motor_pulse(250U, 0U, generation);
        break;
    default:
        break;
    }

    pf_motor_write_stopped();
}

static void pf_motor_task(void *arg)
{
    PF_MOTOR_COMMAND_T command;

    (void)arg;
    for (;;) {
        if (tal_queue_fetch(sg_motor_queue, &command, QUEUE_WAIT_FOREVER) != OPRT_OK) {
            continue;
        }
        if (command.generation == sg_motor_generation) {
            pf_motor_run_pattern(&command);
        }
    }
}

OPERATE_RET pf_motor_init(void)
{
    OPERATE_RET rt;
    TUYA_GPIO_BASE_CFG_T gpio_cfg = {
        .mode = TUYA_GPIO_PUSH_PULL,
        .direct = TUYA_GPIO_OUTPUT,
        .level = TUYA_GPIO_LEVEL_LOW,
    };
    THREAD_CFG_T thread_cfg = {
        .stackDepth = PF_MOTOR_TASK_STACK_SIZE,
        .priority = THREAD_PRIO_5,
        .thrdname = "pf_motor",
    };

    if (sg_motor_initialized) {
        return OPRT_INIT_MORE_THAN_ONCE;
    }

    rt = tkl_gpio_init(PF_MOTOR_IN1_PIN, &gpio_cfg);
    if (rt != OPRT_OK) {
        return rt;
    }
    rt = tkl_gpio_init(PF_MOTOR_IN2_PIN, &gpio_cfg);
    if (rt != OPRT_OK) {
        return rt;
    }
    rt = pf_motor_write_stopped();
    if (rt != OPRT_OK) {
        return rt;
    }

    rt = tal_queue_create_init(&sg_motor_queue, sizeof(PF_MOTOR_COMMAND_T),
                               PF_MOTOR_QUEUE_LENGTH);
    if (rt != OPRT_OK) {
        return rt;
    }

    rt = tal_thread_create_and_start(&sg_motor_thread, NULL, NULL,
                                     pf_motor_task, NULL, &thread_cfg);
    if (rt != OPRT_OK) {
        tal_queue_free(sg_motor_queue);
        sg_motor_queue = NULL;
        return rt;
    }

    sg_motor_initialized = true;
    PR_NOTICE("[motor] ready, stopped");
    return OPRT_OK;
}

OPERATE_RET pf_motor_play(PF_MOTOR_PATTERN_E pattern)
{
    PF_MOTOR_COMMAND_T command;

    if (!sg_motor_initialized) {
        return OPRT_RESOURCE_NOT_READY;
    }
    if (pattern > PF_MOTOR_PATTERN_ERROR) {
        return OPRT_INVALID_PARM;
    }

    pf_motor_stop();
    command.pattern = pattern;
    command.generation = sg_motor_generation;
    return tal_queue_post(sg_motor_queue, &command, 0);
}

OPERATE_RET pf_motor_stop(void)
{
    if (!sg_motor_initialized) {
        return OPRT_RESOURCE_NOT_READY;
    }

    ++sg_motor_generation;
    return pf_motor_write_stopped();
}
