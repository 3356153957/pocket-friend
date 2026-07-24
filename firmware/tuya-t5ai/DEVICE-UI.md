# Pocket Friend · 320x480 Device UI

Target panel: **ILI9488 320x480** + **GT1151** touch.

## Screens

| Page | Trigger | Notes |
|------|---------|-------|
| `PF_UI_PAGE_START` | Boot / not started | Brand sky screen + pink **START** |
| `PF_UI_PAGE_IDLE` | After START | Existing camera / Wi-Fi entry |
| `PF_UI_PAGE_SLEEP` | DND / sleep | Shows **已休眠**; tap screen to wake |

## Preview (no flash needed)

Open `firmware/tuya-t5ai/device-ui-320x480.html` in a browser. Panel size is fixed at 320x480.

## Brand palette

- Sky `#0091FF`
- Lime `#C8FF00`
- Cyan `#00E5FF`
- Pink `#FF2D9B`
- Night `#0A1030`

## Hardware follow-ups

1. Flash overlay and confirm GT1151 hit targets on START / wake.
2. Optional: swap vector pet for PNG/C array pixel art assets.
3. Wire physical long-press / DND button to existing `PF_INPUT_TOGGLE_DND` (already maps to sleep UI).
