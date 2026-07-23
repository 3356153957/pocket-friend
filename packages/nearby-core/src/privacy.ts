import type { DistancePrecision } from "./types.ts";

const PRECISION_RANK: Record<DistancePrecision, number> = {
  "100m": 0,
  "500m": 1,
  "1km": 2,
  region: 3,
};

export function negotiateDistancePrecision(
  mine: DistancePrecision,
  theirs: DistancePrecision,
  mutuallyMatched = true,
): DistancePrecision {
  const selected = PRECISION_RANK[mine] >= PRECISION_RANK[theirs] ? mine : theirs;
  if (!mutuallyMatched && PRECISION_RANK[selected] < PRECISION_RANK["500m"]) {
    return "500m";
  }
  return selected;
}

export function formatSharedDistance(distanceMeters: number, precision: DistancePrecision): string {
  if (precision === "region") {
    return "同一区域";
  }

  const step = precision === "100m" ? 100 : precision === "500m" ? 500 : 1_000;
  const stepCount = precision === "100m"
    ? Math.round(distanceMeters / step)
    : Math.ceil(distanceMeters / step);
  const rounded = Math.max(step, stepCount * step);
  if (rounded >= 1_000) {
    return `约 ${rounded / 1_000} 公里内`;
  }
  return precision === "100m" ? `约 ${rounded} 米` : `约 ${rounded} 米内`;
}

export function isLocationFresh(capturedAt: string, now: Date, maximumAgeMs = 120_000): boolean {
  const age = now.getTime() - new Date(capturedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age <= maximumAgeMs;
}
