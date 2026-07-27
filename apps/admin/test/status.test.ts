import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { DeviceStatusRegistry } from "../src/status.ts";

describe("DeviceStatusRegistry", () => {
  test("returns the web client and two boards in a stable order", () => {
    const registry = new DeviceStatusRegistry({ offlineAfterMs: 45_000 });

    assert.deepEqual(
      registry.snapshot(100_000).devices.map(({ id, online }) => ({ id, online })),
      [
        { id: "web", online: false },
        { id: "board-a", online: false },
        { id: "board-b", online: false },
      ],
    );
  });

  test("marks a device offline once its last heartbeat reaches the threshold", () => {
    const registry = new DeviceStatusRegistry({ offlineAfterMs: 45_000 });
    registry.record({ deviceId: "board-a", firmwareVersion: "0.3.0" }, 10_000);

    assert.equal(registry.snapshot(54_999).devices[1]?.online, true);
    assert.equal(registry.snapshot(55_000).devices[1]?.online, false);
    assert.equal(registry.snapshot(55_000).devices[1]?.firmwareVersion, "0.3.0");
  });

  test("restores board device records after a restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pf-admin-status-"));
    const file = join(directory, "device-state.json");
    try {
      const first = new DeviceStatusRegistry({ offlineAfterMs: 45_000, file });
      first.record({ deviceId: "board-a", firmwareVersion: "0.3.0", batteryPercent: 62 }, 10_000);
      await first.flush();

      const second = new DeviceStatusRegistry({ offlineAfterMs: 45_000, file });
      await second.restore();
      const board = second.snapshot(20_000).devices[1];

      assert.equal(board?.online, true);
      assert.equal(board?.firmwareVersion, "0.3.0");
      assert.equal(board?.batteryPercent, 62);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("restore ignores a missing state file", async () => {
    const registry = new DeviceStatusRegistry({ file: "/nonexistent/device-state.json" });
    await registry.restore();
    assert.equal(registry.snapshot(1_000).summary.online, 0);
  });

  test("counts only active browser sessions", () => {
    const registry = new DeviceStatusRegistry({ offlineAfterMs: 45_000 });
    registry.record({ deviceId: "web", clientId: "browser-one" }, 10_000);
    registry.record({ deviceId: "web", clientId: "browser-two" }, 40_000);

    const web = registry.snapshot(60_000).devices[0];
    assert.equal(web?.online, true);
    assert.equal(web?.sessions.length, 1);
    assert.equal(web?.lastSeenAt, new Date(40_000).toISOString());
  });
});
