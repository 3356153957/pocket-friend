#include "pf_camera.h"

#include "board_com_api.h"
#include "pf_demo_config.h"
#include "tal_api.h"
#include "tdl_camera_manage.h"

#define PF_CAMERA_FPS 15U
#define PF_CAPTURE_STREAM_WARMUP_MS 500U
#define PF_CAPTURE_STREAM_POLL_MS   20U

static TDL_CAMERA_HANDLE_T sg_camera_handle = NULL;
static SEM_HANDLE sg_capture_sem = NULL;
static MUTEX_HANDLE sg_capture_mutex = NULL;
static volatile bool sg_preview_enabled = false;
static PF_CAMERA_FRAME_CB sg_frame_cb = NULL;
static bool sg_capture_requested = false;
static bool sg_capture_in_progress = false;
static uint32_t sg_capture_generation = 0;
static OPERATE_RET sg_capture_result = OPRT_OK;
static uint8_t *sg_jpeg_data = NULL;
static uint32_t sg_jpeg_len = 0;
static bool sg_camera_initialized = false;
static uint32_t sg_capture_stream_until = 0;
static bool sg_capture_stream_ready = false;

static bool pf_camera_elapsed(uint32_t start_ms, uint32_t timeout_ms)
{
    return ((uint32_t)tal_system_get_millisecond() - start_ms) >= timeout_ms;
}

static OPERATE_RET pf_camera_jpeg_cb(TDL_CAMERA_HANDLE_T handle,
                                     TDL_CAMERA_FRAME_T *frame)
{
    uint8_t *copy;
    uint32_t generation;
    OPERATE_RET capture_result;

    (void)handle;
    if (frame == NULL || frame->data == NULL || frame->data_len == 0U) {
        return OPRT_OK;
    }

    tal_mutex_lock(sg_capture_mutex);
    if (sg_capture_stream_until != 0U) {
        sg_capture_stream_ready = true;
    }
    if (!sg_capture_requested) {
        tal_mutex_unlock(sg_capture_mutex);
        return OPRT_OK;
    }
    sg_capture_requested = false;
    generation = sg_capture_generation;
    tal_mutex_unlock(sg_capture_mutex);

    copy = tal_psram_malloc(frame->data_len);
    if (copy != NULL) {
        memcpy(copy, frame->data, frame->data_len);
    }

    tal_mutex_lock(sg_capture_mutex);
    if (!sg_capture_in_progress || generation != sg_capture_generation) {
        tal_mutex_unlock(sg_capture_mutex);
        tal_psram_free(copy);
        return OPRT_OK;
    }

    if (copy == NULL) {
        sg_capture_result = OPRT_MALLOC_FAILED;
    } else {
        tal_psram_free(sg_jpeg_data);
        sg_jpeg_data = copy;
        sg_jpeg_len = frame->data_len;
        sg_capture_result = OPRT_OK;
    }
    capture_result = sg_capture_result;
    tal_mutex_unlock(sg_capture_mutex);
    tal_semaphore_post(sg_capture_sem);

    return capture_result;
}

static OPERATE_RET pf_camera_yuv_cb(TDL_CAMERA_HANDLE_T handle,
                                    TDL_CAMERA_FRAME_T *frame)
{
    PF_CAMERA_FRAME_CB callback;

    (void)handle;
    if (!sg_preview_enabled || frame == NULL || frame->data == NULL) {
        return OPRT_OK;
    }

    callback = sg_frame_cb;
    if (callback != NULL) {
        callback(frame->data, frame->width, frame->height);
    }

    return OPRT_OK;
}

OPERATE_RET pf_camera_init(void)
{
    OPERATE_RET rt;
    TDL_CAMERA_CFG_T config = {
        .fps = PF_CAMERA_FPS,
        .width = PF_CAMERA_WIDTH,
        .height = PF_CAMERA_HEIGHT,
        .get_frame_cb = pf_camera_yuv_cb,
        .get_encoded_frame_cb = pf_camera_jpeg_cb,
        .out_fmt = TDL_CAMERA_FMT_JPEG_YUV422_BOTH,
        .encoded_quality.jpeg_cfg = {
            .enable = 1,
            .max_size = 25,
            .min_size = 10,
        },
    };

    if (sg_camera_initialized) {
        return OPRT_INIT_MORE_THAN_ONCE;
    }

    sg_camera_handle = tdl_camera_find_dev(CAMERA_NAME);
    if (sg_camera_handle == NULL) {
        return OPRT_NOT_FOUND;
    }

    rt = tal_semaphore_create_init(&sg_capture_sem, 0, 1);
    if (rt != OPRT_OK) {
        return rt;
    }
    rt = tal_mutex_create_init(&sg_capture_mutex);
    if (rt != OPRT_OK) {
        tal_semaphore_release(sg_capture_sem);
        sg_capture_sem = NULL;
        return rt;
    }
    rt = tdl_camera_dev_open(sg_camera_handle, &config);
    if (rt != OPRT_OK) {
        tal_mutex_release(sg_capture_mutex);
        tal_semaphore_release(sg_capture_sem);
        sg_capture_mutex = NULL;
        sg_capture_sem = NULL;
        return rt;
    }

    sg_camera_initialized = true;
    return OPRT_OK;
}

void pf_camera_preview_enable(bool enable)
{
    sg_preview_enabled = enable;
}

void pf_camera_set_frame_cb(PF_CAMERA_FRAME_CB cb)
{
    sg_frame_cb = cb;
}

void pf_camera_prepare_capture_stream(void)
{
    if (!sg_camera_initialized) {
        return;
    }

    tal_mutex_lock(sg_capture_mutex);
    sg_capture_stream_ready = false;
    sg_capture_stream_until =
        (uint32_t)tal_system_get_millisecond() + PF_CAPTURE_STREAM_WARMUP_MS;
    tal_mutex_unlock(sg_capture_mutex);
}

bool pf_camera_capture_stream_ready(void)
{
    bool ready;

    tal_mutex_lock(sg_capture_mutex);
    ready = sg_capture_stream_ready;
    tal_mutex_unlock(sg_capture_mutex);

    return ready;
}

OPERATE_RET pf_camera_capture_jpeg(uint8_t **data, uint32_t *len)
{
    OPERATE_RET rt;
    uint32_t wait_start_ms;

    if (data == NULL || len == NULL) {
        return OPRT_INVALID_PARM;
    }
    *data = NULL;
    *len = 0;
    if (!sg_camera_initialized) {
        return OPRT_RESOURCE_NOT_READY;
    }

    wait_start_ms = (uint32_t)tal_system_get_millisecond();
    while (!pf_camera_capture_stream_ready() &&
           !pf_camera_elapsed(wait_start_ms, PF_CAPTURE_STREAM_WARMUP_MS)) {
        tal_system_sleep(PF_CAPTURE_STREAM_POLL_MS);
    }

    tal_mutex_lock(sg_capture_mutex);
    if (sg_capture_in_progress) {
        tal_mutex_unlock(sg_capture_mutex);
        return OPRT_RESOURCE_NOT_READY;
    }
    sg_capture_stream_until = 0;
    ++sg_capture_generation;
    sg_capture_requested = true;
    sg_capture_in_progress = true;
    sg_capture_result = OPRT_TIMEOUT;
    tal_mutex_unlock(sg_capture_mutex);

    rt = tal_semaphore_wait(sg_capture_sem, PF_CAPTURE_TIMEOUT_MS);

    tal_mutex_lock(sg_capture_mutex);
    if (rt != OPRT_OK) {
        ++sg_capture_generation;
        sg_capture_requested = false;
        sg_capture_in_progress = false;
        tal_mutex_unlock(sg_capture_mutex);
        return rt;
    }

    rt = sg_capture_result;
    if (rt == OPRT_OK) {
        *data = sg_jpeg_data;
        *len = sg_jpeg_len;
        sg_jpeg_data = NULL;
        sg_jpeg_len = 0;
    }
    sg_capture_in_progress = false;
    tal_mutex_unlock(sg_capture_mutex);

    return rt;
}

void pf_camera_release_jpeg(uint8_t *data)
{
    tal_psram_free(data);
}
