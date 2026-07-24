#include "pf_app.h"
#include "pf_demo_config.h"
#include "board_com_api.h"
#include "tal_api.h"
#include "tkl_output.h"

void user_main(void)
{
    OPERATE_RET rt = OPRT_OK;

    tal_log_init(TAL_LOG_LEVEL_DEBUG, 1024,
                 (TAL_LOG_OUTPUT_CB)tkl_log_output);
    tal_sw_timer_init();
    tal_workq_init();

    PR_NOTICE("Pocket Friend dual-device demo: %c", PF_DEVICE_ID);
    PR_NOTICE("Platform board: %s", PLATFORM_BOARD);

    board_register_hardware();
    TUYA_CALL_ERR_LOG(pf_app_start());
}

#if OPERATING_SYSTEM == SYSTEM_LINUX
void main(int argc, char *argv[])
{
    (void)argc;
    (void)argv;
    user_main();
}
#else
static THREAD_HANDLE sg_main_thread;

static void pf_main_task(void *arg)
{
    (void)arg;
    user_main();
    tal_thread_delete(sg_main_thread);
    sg_main_thread = NULL;
}

void tuya_app_main(void)
{
    THREAD_CFG_T config = {
        .stackDepth = 4096,
        .priority = THREAD_PRIO_1,
        .thrdname = "tuya_app_main",
    };
    tal_thread_create_and_start(&sg_main_thread, NULL, NULL,
                                pf_main_task, NULL, &config);
}
#endif
