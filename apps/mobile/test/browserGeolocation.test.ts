import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  HIGH_ACCURACY_POSITION_OPTIONS,
  watchBrowserPosition,
} from "../src/location/browserGeolocation.ts";

describe("browser geolocation adapter", () => {
  test("requests fresh high-accuracy samples and clears the native watch", () => {
    let successCallback: ((position: never) => void) | undefined;
    let errorCallback: ((error: { code: number; message: string }) => void)
      | undefined;
    let receivedOptions: PositionOptions | undefined;
    let clearedWatchId: number | undefined;
    const geolocation = {
      watchPosition(
        success: (position: never) => void,
        error: (error: { code: number; message: string }) => void,
        options: PositionOptions,
      ) {
        successCallback = success;
        errorCallback = error;
        receivedOptions = options;
        return 42;
      },
      clearWatch(watchId: number) {
        clearedWatchId = watchId;
      },
    };
    const failures: string[] = [];

    const subscription = watchBrowserPosition(
      geolocation,
      () => undefined,
      (reason) => failures.push(reason),
    );

    assert.equal(typeof successCallback, "function");
    assert.equal(typeof errorCallback, "function");
    assert.deepEqual(receivedOptions, HIGH_ACCURACY_POSITION_OPTIONS);

    errorCallback?.({ code: 2, message: "unavailable" });
    assert.deepEqual(failures, ["浏览器暂时无法确定位置"]);

    subscription.remove();
    assert.equal(clearedWatchId, 42);
  });

  test("maps browser timeout and permission errors to user-facing messages", () => {
    const callbacks: Array<(error: { code: number; message: string }) => void> = [];
    const geolocation = {
      watchPosition(
        _success: (position: never) => void,
        error: (error: { code: number; message: string }) => void,
      ) {
        callbacks.push(error);
        return callbacks.length;
      },
      clearWatch() {},
    };
    const failures: string[] = [];

    watchBrowserPosition(geolocation, () => undefined, (reason) => {
      failures.push(reason);
    });
    callbacks[0]?.({ code: 1, message: "denied" });

    watchBrowserPosition(geolocation, () => undefined, (reason) => {
      failures.push(reason);
    });
    callbacks[1]?.({ code: 3, message: "timeout" });

    assert.deepEqual(failures, ["定位权限未开启", "浏览器定位超时"]);
  });
});
