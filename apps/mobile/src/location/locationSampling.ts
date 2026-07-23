import type { GeoPoint } from "../../../../packages/nearby-core/src/index.ts";

export const LOCATION_TARGET_ACCURACY_METERS = 30;
export const LOCATION_SAMPLE_TIMEOUT_MS = 15_000;

const COARSE_LOCATION_ACCURACY_METERS = 100;
const UNKNOWN_LOCATION_ACCURACY_METERS = 5_000;

export interface BrowserLocationObject {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
  };
  timestamp: number;
}

export type LocationAccuracyPhase = "sampling" | "complete";

export function toNativeGeoPoint(location: BrowserLocationObject): GeoPoint {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters:
      location.coords.accuracy ?? UNKNOWN_LOCATION_ACCURACY_METERS,
    capturedAt: new Date(location.timestamp).toISOString(),
    coordinateSystem: "wgs84",
    source: "native",
  };
}

export function selectBestLocationSample(
  current: GeoPoint | null,
  candidate: GeoPoint,
): GeoPoint {
  if (!current || candidate.accuracyMeters < current.accuracyMeters) {
    return candidate;
  }

  return current;
}

export function hasReachedTargetAccuracy(location: GeoPoint): boolean {
  return location.accuracyMeters <= LOCATION_TARGET_ACCURACY_METERS;
}

export function formatLocationAccuracy(
  location: GeoPoint,
  phase: LocationAccuracyPhase,
): string {
  const accuracy = Math.round(location.accuracyMeters);
  const message = phase === "sampling"
    ? `正在提高定位精度 · 当前 ±${accuracy} 米`
    : `网页定位完成 · 定位精度 ±${accuracy} 米`;

  if (
    phase === "complete"
    && location.accuracyMeters > COARSE_LOCATION_ACCURACY_METERS
  ) {
    return `${message} · 当前浏览器仅提供粗略位置`;
  }

  return message;
}
