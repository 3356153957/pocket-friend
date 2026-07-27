import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { AuthThrottle } from "../src/authThrottle.ts";

describe("auth throttle", () => {
  test("locks a key after the failure limit and releases after the lockout", () => {
    const throttle = new AuthThrottle({ maxFailures: 3, windowMs: 60_000, lockoutMs: 30_000 });

    throttle.recordFailure("admin:1.2.3.4", 1_000);
    throttle.recordFailure("admin:1.2.3.4", 2_000);
    assert.equal(throttle.retryAfterSeconds("admin:1.2.3.4", 2_500), 0);

    throttle.recordFailure("admin:1.2.3.4", 3_000);
    assert.equal(throttle.retryAfterSeconds("admin:1.2.3.4", 3_000), 30);
    assert.equal(throttle.retryAfterSeconds("admin:1.2.3.4", 18_000), 15);
    assert.equal(throttle.retryAfterSeconds("admin:1.2.3.4", 33_000), 0);
  });

  test("expires stale failures outside the window", () => {
    const throttle = new AuthThrottle({ maxFailures: 2, windowMs: 10_000, lockoutMs: 30_000 });

    throttle.recordFailure("admin:1.2.3.4", 1_000);
    throttle.recordFailure("admin:1.2.3.4", 20_000);
    assert.equal(throttle.retryAfterSeconds("admin:1.2.3.4", 20_000), 0);

    throttle.recordFailure("admin:1.2.3.4", 21_000);
    assert.equal(throttle.retryAfterSeconds("admin:1.2.3.4", 21_000), 30);
  });

  test("success clears the failure counter", () => {
    const throttle = new AuthThrottle({ maxFailures: 2, windowMs: 60_000, lockoutMs: 30_000 });

    throttle.recordFailure("admin:1.2.3.4", 1_000);
    throttle.recordSuccess("admin:1.2.3.4");
    throttle.recordFailure("admin:1.2.3.4", 2_000);
    assert.equal(throttle.retryAfterSeconds("admin:1.2.3.4", 2_000), 0);
  });

  test("tracks keys independently", () => {
    const throttle = new AuthThrottle({ maxFailures: 1, windowMs: 60_000, lockoutMs: 30_000 });

    throttle.recordFailure("admin:1.2.3.4", 1_000);
    assert.equal(throttle.retryAfterSeconds("admin:1.2.3.4", 1_000), 30);
    assert.equal(throttle.retryAfterSeconds("admin:5.6.7.8", 1_000), 0);
    assert.equal(throttle.retryAfterSeconds("device:1.2.3.4", 1_000), 0);
  });
});
