# T5AI Heartbeat And Photo Upload Implementation Plan

> **For AI worker:** Required sub-skill: use test-driven-development and verification-before-completion while executing each task.

**Goal:** Enable board heartbeats and let a user capture a JPEG from the camera preview and upload it to the Pocket Friend server.

**Architecture:** The admin server keeps the latest JPEG for board A and board B in memory. Boards authenticate heartbeat and photo requests with the same build-time Bearer token. The firmware camera button reuses the existing capture worker, shows the captured JPEG locally, then uploads it without embedding credentials in Git.

**Tech stack:** TuyaOpen T5AI C firmware, LVGL 9, Tuya HTTP client, Node.js 22 TypeScript admin server, PowerShell contract tests.

---

### Task 1: Server latest-photo API

**Files:**
- Create: `apps/admin/src/photos.ts`
- Modify: `apps/admin/src/router.ts`
- Modify: `apps/admin/src/server.ts`
- Test: `apps/admin/test/router.test.ts`
- Test: `apps/admin/test/server.test.ts`

- [x] Add failing tests for authenticated JPEG upload, invalid device/content type/size, and Basic-authenticated latest-photo download.
- [x] Run `node --experimental-strip-types --test apps/admin/test/router.test.ts apps/admin/test/server.test.ts` and confirm the new tests fail because the routes do not exist.
- [x] Add an in-memory store with one bounded latest JPEG per board and route `POST /api/photos?deviceId=...` plus `GET /api/photos/:deviceId/latest`.
- [x] Raise the HTTP request-body limit only to the selected JPEG maximum and preserve the existing JSON limits logically in the router.
- [x] Re-run the focused tests and `npm run typecheck`.
- [x] Commit and push the server branch without credentials.

### Task 2: Firmware heartbeat and photo uploader contract

**Files:**
- Modify: `firmware/tuya-t5ai/tests/validate-dual-demo.ps1`
- Modify: `firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_server_heartbeat.h`
- Modify: `firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_server_heartbeat.c`
- Modify: `firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_input.h`
- Modify: `firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_input.c`
- Modify: `firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_ui.c`
- Modify: `firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_app.c`

- [x] Add failing contract assertions for `PF_INPUT_CAPTURE_PHOTO`, the preview capture button, `pf_server_photo_upload`, JPEG content type, device query, and local result display.
- [x] Run `firmware/tuya-t5ai/tests/validate-dual-demo.ps1` and confirm failure on the first missing contract.
- [x] Add the capture input action and a stable bottom-center LVGL camera button.
- [x] Extend the server transport module with a synchronous JPEG upload function guarded by the same runtime feature flag and token.
- [x] Reuse the capture worker for manual preview captures, stop preview before capture, show the result, upload it, and return to preview/result through explicit app events.
- [x] Re-run all firmware contract tests.

### Task 3: Build, flash, and live verification

**Files:**
- Runtime only: `D:\TuyaOpen\examples\graphics\lvgl_camera\include\pf_demo_runtime_config.h`

- [x] Obtain the server-generated device token from the server environment without printing or saving it in Git or the knowledge base.
- [x] Generate device A runtime configuration using admin host `117.72.82.29`, port `4311`, and the token.
- [x] Build with the TuyaOpen managed Python and GNU Make paths; require `BUILD SUCCESS`.
- [x] Flash COM4 with tyutool and require CRC success.
- [ ] Verify green Wi-Fi icon, server heartbeat status, one-button capture, local JPEG result, and authenticated server photo retrieval.
- [x] Commit and push only the firmware files belonging to this feature; preserve unrelated worktree changes.
