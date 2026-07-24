import type { GeoPoint } from "../../../../packages/nearby-core/src/index.ts";
import type { BrowserLocationSubscription } from "./browserGeolocation.ts";
import {
  LOCATION_EMPTY_TIMEOUT_MESSAGE,
  LOCATION_SAMPLE_TIMEOUT_MS,
  hasReachedTargetAccuracy,
  selectBestLocationSample,
  toNativeGeoPoint,
  type BrowserLocationObject,
} from "./locationSampling.ts";

interface LocationSamplerDependencies {
  watch(
    onSample: (sample: BrowserLocationObject) => void,
    onError: (reason: string) => void,
  ): BrowserLocationSubscription;
  setTimer(callback: () => void, timeoutMs: number): unknown;
  clearTimer(timer: unknown): void;
  onProgress?: (location: GeoPoint) => void;
}

export interface LocationSampler {
  sample(): Promise<GeoPoint>;
  cancel(): void;
}

interface ActiveSample {
  best: GeoPoint | null;
  subscription: BrowserLocationSubscription | null;
  timer: unknown;
  settled: boolean;
  resolve: (location: GeoPoint) => void;
  reject: (error: Error) => void;
}

export function createLocationSampler(
  dependencies: LocationSamplerDependencies,
): LocationSampler {
  let active: ActiveSample | null = null;

  function finish(sample: ActiveSample, error?: Error): void {
    if (sample.settled) return;

    sample.settled = true;
    sample.subscription?.remove();
    dependencies.clearTimer(sample.timer);
    if (active === sample) active = null;

    if (error) {
      sample.reject(error);
    } else if (sample.best) {
      sample.resolve(sample.best);
    } else {
      sample.reject(new Error(LOCATION_EMPTY_TIMEOUT_MESSAGE));
    }
  }

  function cancel(): void {
    if (active) finish(active, new Error("定位已取消"));
  }

  return {
    sample(): Promise<GeoPoint> {
      cancel();

      return new Promise<GeoPoint>((resolve, reject) => {
        const sample: ActiveSample = {
          best: null,
          subscription: null,
          timer: null,
          settled: false,
          resolve,
          reject,
        };
        active = sample;

        sample.timer = dependencies.setTimer(
          () => finish(sample),
          LOCATION_SAMPLE_TIMEOUT_MS,
        );

        try {
          const subscription = dependencies.watch(
            (browserLocation) => {
              if (sample.settled) return;

              const candidate = toNativeGeoPoint(browserLocation);
              const nextBest = selectBestLocationSample(sample.best, candidate);
              if (nextBest !== sample.best) {
                sample.best = nextBest;
                dependencies.onProgress?.(nextBest);
              }

              if (hasReachedTargetAccuracy(nextBest)) finish(sample);
            },
            (reason) => finish(sample, new Error(reason)),
          );

          if (sample.settled) {
            subscription.remove();
          } else {
            sample.subscription = subscription;
          }
        } catch (error) {
          finish(
            sample,
            error instanceof Error ? error : new Error("浏览器定位失败"),
          );
        }
      });
    },
    cancel,
  };
}
