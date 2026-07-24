#include "pf_server_heartbeat.h"

#include "http_client_interface.h"
#include "pf_demo_config.h"
#include "tal_api.h"

#define PF_SERVER_HEARTBEAT_TIMEOUT_MS 5000U
#define PF_SERVER_PHOTO_TIMEOUT_MS 10000U
#define PF_SERVER_HEARTBEAT_STACK_SIZE 4096U
#define PF_SERVER_FILENAME_ENCODED_MAX 384U

static bool pf_server_url_is_unreserved(char ch)
{
    return (ch >= 'A' && ch <= 'Z') ||
           (ch >= 'a' && ch <= 'z') ||
           (ch >= '0' && ch <= '9') ||
           ch == '-' || ch == '_' || ch == '.' || ch == '~';
}

static void pf_server_url_encode(const char *src, char *dst, size_t dst_size)
{
    static const char hex[] = "0123456789ABCDEF";
    size_t out = 0U;

    if (dst == NULL || dst_size == 0U) {
        return;
    }
    if (src == NULL) {
        dst[0] = '\0';
        return;
    }

    while (*src != '\0' && out + 1U < dst_size) {
        unsigned char ch = (unsigned char)*src++;
        if (pf_server_url_is_unreserved((char)ch)) {
            dst[out++] = (char)ch;
        } else if (out + 3U < dst_size) {
            dst[out++] = '%';
            dst[out++] = hex[(ch >> 4) & 0x0FU];
            dst[out++] = hex[ch & 0x0FU];
        } else {
            break;
        }
    }
    dst[out] = '\0';
}

#if PF_SERVER_HEARTBEAT_ENABLED
static THREAD_HANDLE sg_server_heartbeat_thread;
static MUTEX_HANDLE sg_server_request_mutex;
#endif
static volatile bool sg_server_heartbeat_network_ready;
static bool sg_server_heartbeat_initialized;

#if PF_SERVER_HEARTBEAT_ENABLED
static OPERATE_RET pf_server_heartbeat_send(void)
{
    char authorization[160];
    char body[128];
    http_client_response_t response = {0};
    http_client_status_t status;
    http_client_header_t headers[] = {
        {.key = "Content-Type", .value = "application/json"},
        {.key = "Authorization", .value = authorization},
    };

    snprintf(authorization, sizeof(authorization), "Bearer %s",
             PF_DEVICE_HEARTBEAT_TOKEN);
    snprintf(body, sizeof(body),
             "{\"deviceId\":\"board-%c\",\"firmwareVersion\":\"%s\"}",
             (char)(PF_DEVICE_ID + ('a' - 'A')), PF_FIRMWARE_VERSION);

    tal_mutex_lock(sg_server_request_mutex);
    status = http_client_request(
        &(const http_client_request_t){
            .host = PF_ADMIN_HOST,
            .port = PF_ADMIN_PORT,
            .path = "/api/heartbeat",
            .method = "POST",
            .headers = headers,
            .headers_count = sizeof(headers) / sizeof(headers[0]),
            .body = (const uint8_t *)body,
            .body_length = strlen(body),
            .timeout_ms = PF_SERVER_HEARTBEAT_TIMEOUT_MS,
        },
        &response);
    tal_mutex_unlock(sg_server_request_mutex);
    if (status != HTTP_CLIENT_SUCCESS) {
        PR_WARN("[heartbeat] request failed: %d", status);
        http_client_free(&response);
        return OPRT_COM_ERROR;
    }
    if (response.status_code != 204U) {
        PR_WARN("[heartbeat] server returned HTTP %u", response.status_code);
        http_client_free(&response);
        return OPRT_COM_ERROR;
    }
    http_client_free(&response);
    return OPRT_OK;
}

static void pf_server_heartbeat_task(void *arg)
{
    bool reported_for_connection = false;
    uint32_t last_report_ms = 0U;
    (void)arg;

    for (;;) {
        uint32_t now = (uint32_t)tal_system_get_millisecond();
        if (!sg_server_heartbeat_network_ready) {
            reported_for_connection = false;
        } else if (!reported_for_connection ||
                   (uint32_t)(now - last_report_ms) >= PF_SERVER_HEARTBEAT_MS) {
            (void)pf_server_heartbeat_send();
            last_report_ms = now;
            reported_for_connection = true;
        }
        tal_system_sleep(250U);
    }
}
#endif

OPERATE_RET pf_server_heartbeat_init(void)
{
#if PF_SERVER_HEARTBEAT_ENABLED
    THREAD_CFG_T thread_cfg = {
        .stackDepth = PF_SERVER_HEARTBEAT_STACK_SIZE,
        .priority = THREAD_PRIO_3,
        .thrdname = "pf_srv_heartbeat",
    };
    OPERATE_RET rt;

    if (sg_server_heartbeat_initialized) {
        return OPRT_INIT_MORE_THAN_ONCE;
    }
    rt = tal_mutex_create_init(&sg_server_request_mutex);
    if (rt != OPRT_OK) {
        return rt;
    }
    rt = tal_thread_create_and_start(&sg_server_heartbeat_thread, NULL, NULL,
                                     pf_server_heartbeat_task, NULL,
                                     &thread_cfg);
    if (rt == OPRT_OK) {
        sg_server_heartbeat_initialized = true;
    }
    return rt;
#else
    sg_server_heartbeat_initialized = true;
    return OPRT_OK;
#endif
}

void pf_server_heartbeat_network_up(void)
{
    if (sg_server_heartbeat_initialized) {
        sg_server_heartbeat_network_ready = true;
    }
}

void pf_server_heartbeat_network_down(void)
{
    sg_server_heartbeat_network_ready = false;
}

OPERATE_RET pf_server_photo_upload(const uint8_t *jpeg, uint32_t len,
                                   const char *filename)
{
#if PF_SERVER_HEARTBEAT_ENABLED
    char authorization[160];
    char encoded_filename[PF_SERVER_FILENAME_ENCODED_MAX];
    char path[448];
    http_client_response_t response = {0};
    http_client_status_t status;
    http_client_header_t headers[] = {
        {.key = "Content-Type", .value = "image/jpeg"},
        {.key = "Authorization", .value = authorization},
    };

    if (jpeg == NULL || len == 0U) {
        return OPRT_INVALID_PARM;
    }
    if (!sg_server_heartbeat_initialized ||
        !sg_server_heartbeat_network_ready) {
        return OPRT_RESOURCE_NOT_READY;
    }
    snprintf(authorization, sizeof(authorization), "Bearer %s",
             PF_DEVICE_HEARTBEAT_TOKEN);
    pf_server_url_encode(filename != NULL ? filename : "photo.jpg",
                         encoded_filename, sizeof(encoded_filename));
    snprintf(path, sizeof(path), "/api/photos?deviceId=board-%c&filename=%s",
             (char)(PF_DEVICE_ID + ('a' - 'A')), encoded_filename);

    tal_mutex_lock(sg_server_request_mutex);
    status = http_client_request(
        &(const http_client_request_t){
            .host = PF_ADMIN_HOST,
            .port = PF_ADMIN_PORT,
            .path = path,
            .method = "POST",
            .headers = headers,
            .headers_count = sizeof(headers) / sizeof(headers[0]),
            .body = jpeg,
            .body_length = len,
            .timeout_ms = PF_SERVER_PHOTO_TIMEOUT_MS,
        },
        &response);
    tal_mutex_unlock(sg_server_request_mutex);
    if (status != HTTP_CLIENT_SUCCESS) {
        PR_WARN("[photo] upload failed: %d", status);
        http_client_free(&response);
        return OPRT_COM_ERROR;
    }
    if (response.status_code != 204U) {
        PR_WARN("[photo] server returned HTTP %u", response.status_code);
        http_client_free(&response);
        return OPRT_COM_ERROR;
    }
    http_client_free(&response);
    PR_NOTICE("[photo] uploaded %u bytes", len);
    return OPRT_OK;
#else
    (void)jpeg;
    (void)len;
    (void)filename;
    return OPRT_RESOURCE_NOT_READY;
#endif
}
