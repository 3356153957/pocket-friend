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
    assert.equal((await response.json()).summary.total, 3);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
