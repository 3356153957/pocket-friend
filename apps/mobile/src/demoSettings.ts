import type {
  DistancePrecision,
  PlayerProfile,
} from "../../../packages/nearby-core/src/index.ts";

export type LocationMode = "simulated" | "native" | "jacoo";

export interface DemoDiscoverySettings {
  discoverable: boolean;
  discoveryRadiusMeters: number;
  distancePrecision: DistancePrecision;
}

export const DISCOVERY_RADIUS_OPTIONS = [300, 800, 1_500] as const;
export const DISTANCE_PRECISION_OPTIONS: readonly DistancePrecision[] = [
  "100m",
  "500m",
  "1km",
  "region",
];

export function createDemoProfile(
  baseProfile: PlayerProfile,
  settings: DemoDiscoverySettings,
): PlayerProfile {
  return {
    ...baseProfile,
    ...settings,
  };
}

export function getLocationModes(input: {
  jacooEnabled: boolean;
  production: boolean;
}): LocationMode[] {
  const modes: LocationMode[] = ["simulated", "native"];

  if (input.jacooEnabled && !input.production) {
    modes.push("jacoo");
  }

  return modes;
}
