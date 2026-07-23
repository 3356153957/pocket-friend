import assert from "node:assert/strict";
import { test } from "node:test";

import { createGatewayServer } from "../src/server.ts";

test("Gateway server listens and serves the health route", async () => {
  const server = createGatewayServer({ env: {} });

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

    const response = await fetch(`http://127.0.0.1:${address.port}/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
      service: "pocket-friend-gateway",
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
