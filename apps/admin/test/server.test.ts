import assert from "node:assert/strict";
import { test } from "node:test";

import { createAdminServer } from "../src/server.ts";

test("admin server listens independently and serves authenticated status", async () => {
  const server = createAdminServer({
    env: {
      PF_ADMIN_USERNAME: "operator",
      PF_ADMIN_PASSWORD: "correct-horse",
      PF_DEVICE_HEARTBEAT_TOKEN: "board-secret",
    },
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const authorization = Buffer.from("operator:correct-horse").toString("base64");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/status`, {
      headers: { Authorization: `Basic ${authorization}` },
    });

    assert.equal(response.status, 200);
    assert.equal((await response.json()).summary.total, 2);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("admin server accepts camera-sized JPEGs and rejects bodies larger than 512 KiB", async () => {
  const server = createAdminServer({
    env: {
      PF_ADMIN_USERNAME: "operator",
      PF_ADMIN_PASSWORD: "correct-horse",
      PF_DEVICE_HEARTBEAT_TOKEN: "board-secret",
    },
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const cameraJpeg = new Uint8Array(200 * 1024);
    cameraJpeg[0] = 0xff;
    cameraJpeg[1] = 0xd8;
    cameraJpeg[cameraJpeg.length - 2] = 0xff;
    cameraJpeg[cameraJpeg.length - 1] = 0xd9;
    const accepted = await fetch(`http://127.0.0.1:${address.port}/api/photos?deviceId=board-a`, {
      method: "POST",
      headers: { Authorization: "Bearer board-secret", "Content-Type": "image/jpeg" },
      body: cameraJpeg,
    });
    assert.equal(accepted.status, 204);

    const response = await fetch(`http://127.0.0.1:${address.port}/api/photos?deviceId=board-a`, {
      method: "POST",
      headers: { Authorization: "Bearer board-secret", "Content-Type": "image/jpeg" },
      body: new Uint8Array(512 * 1024 + 1),
    });
    assert.equal(response.status, 413);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
