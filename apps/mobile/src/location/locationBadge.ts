import type { GeoPoint } from "../../../../packages/nearby-core/src/index.ts";
import type { LocationMode } from "../app/useNearbyDemo.ts";

export function getLocationBadge(state: {
  loading: boolean;
  location: GeoPoint | null;
  mode: LocationMode;
}): "GPS" | "DEMO" | "LOCATING" | "NO FIX" {
  if (state.loading) return "LOCATING";
  if (!state.location) return "NO FIX";
  return state.mode === "native" ? "GPS" : "DEMO";
}
