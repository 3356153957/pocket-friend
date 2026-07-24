import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createPresenceUrl,
  startPresenceHeartbeat,
} from "../src/presence/presenceHeartbeat.ts";

describe("web presence heartbeat", () => {
  test("uses the current hostname and the independent admin port", () => {
    assert.equal(
      createPresenceUrl({ protocol: "http:", hostname: "117.72.82.29" }),
      "http://117.72.82.29:4311/api/heartbeat",
    );
  });

  test("reports immediately, repeats, and can be stopped", async () => {
    const calls: string[] = [];
    let scheduled: (() => void) | undefined;
    let cleared: unknown;
    const stop = startPresenceHeartbeat({
      endpoint: "http://server:4311/api/heartbeat",
      clientId: "browser-one",
      fetcher: async (url) => {
        calls.push(String(url));
        return new Response(null, { status: 204 });
      },
      setIntervalFn: (callback) => {
        scheduled = callback;
        return 17;
      },
      clearIntervalFn: (handle) => {
        cleared = handle;
      },
    });

    await Promise.resolve();
    assert.deepEqual(calls, ["http://server:4311/api/heartbeat"]);
    scheduled?.();
    await Promise.resolve();
    assert.equal(calls.length, 2);
    stop();
    assert.equal(cleared, 17);
  });
});
