import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { BrowserLocationObject } from "../src/location/locationSampling.ts";
import { createLocationSampler } from "../src/location/locationController.ts";

function browserPoint(accuracy: number): BrowserLocationObject {
  return {
    coords: {
      latitude: 30.293312,
      longitude: 120.007986,
      accuracy,
    },
    timestamp: Date.parse("2026-07-24T10:00:00.000+08:00"),
  };
}

function harness() {
  let onSample: ((sample: BrowserLocationObject) => void) | undefined;
  let onError: ((reason: string) => void) | undefined;
  let onTimeout: (() => void) | undefined;
  let removes = 0;
  let clears = 0;
  const progress: number[] = [];

  const sampler = createLocationSampler({
    watch(sample, error) {
      onSample = sample;
      onError = error;
      return { remove: () => { removes += 1; } };
    },
    setTimer(callback) {
      onTimeout = callback;
      return 7;
    },
    clearTimer() {
      clears += 1;
    },
    onProgress(location) {
      progress.push(location.accuracyMeters);
    },
  });

  return {
    sampler,
    sample: (accuracy: number) => onSample?.(browserPoint(accuracy)),
    fail: (reason: string) => onError?.(reason),
    timeout: () => onTimeout?.(),
    progress,
    counts: () => ({ removes, clears }),
  };
}

describe("browser location controller", () => {
  test("finishes early when a sample reaches target accuracy", async () => {
    const h = harness();
    const result = h.sampler.sample();

    h.sample(80);
    h.sample(24);

    assert.equal((await result).accuracyMeters, 24);
    assert.deepEqual(h.progress, [80, 24]);
    assert.deepEqual(h.counts(), { removes: 1, clears: 1 });
  });

  test("returns the best sample when the sampling window expires", async () => {
    const h = harness();
    const result = h.sampler.sample();

    h.sample(120);
    h.sample(54);
    h.sample(90);
    h.timeout();

    assert.equal((await result).accuracyMeters, 54);
    assert.deepEqual(h.progress, [120, 54]);
  });

  test("reports the empty-location message when no sample arrives", async () => {
    const h = harness();
    const result = h.sampler.sample();

    h.timeout();

    await assert.rejects(result, /暂时无法获取位置，请检查浏览器定位权限/);
  });

  test("forwards browser errors and supports explicit cancellation", async () => {
    const failed = harness();
    const failedResult = failed.sampler.sample();
    failed.fail("定位权限未开启");
    await assert.rejects(failedResult, /定位权限未开启/);

    const cancelled = harness();
    const cancelledResult = cancelled.sampler.sample();
    cancelled.sampler.cancel();
    await assert.rejects(cancelledResult, /定位已取消/);
    assert.deepEqual(cancelled.counts(), { removes: 1, clears: 1 });
  });
});
