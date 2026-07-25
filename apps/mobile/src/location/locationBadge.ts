import type { GeoPoint } from "../../../../packages/nearby-core/src/index.ts";
import type { LocationMode } from "../app/useNearbyDemo.ts";

export function getLocationBadge(state: {
  loading: boolean;
  location: GeoPoint | null;
  mode: LocationMode;
}): "真实定位" | "演示定位" | "定位中" | "未定位" {
  if (state.loading) return "定位中";
  if (!state.location) return "未定位";
  return state.mode === "native" ? "真实定位" : "演示定位";
}
