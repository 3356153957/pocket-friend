import type {
  PlayerProfile,
  PresenceSnapshot,
} from "../../../../packages/nearby-core/src/index.ts";

export const DEMO_CURRENT_PLAYER: PlayerProfile = {
  id: "me",
  displayName: "你",
  avatar: "mint",
  interests: ["citywalk", "咖啡拉花", "冷门电影"],
  discoverable: true,
  discoveryRadiusMeters: 800,
  distancePrecision: "100m",
};

export const DEMO_PRESENCES: PresenceSnapshot[] = [
  {
    profile: {
      id: "ada",
      displayName: "呦呦",
      avatar: "coral",
      interests: ["独立书店", "深夜写字", "coffee"],
      discoverable: true,
      discoveryRadiusMeters: 800,
      distancePrecision: "100m",
    },
    location: {
      latitude: 30.292227,
      longitude: 120.00487,
      accuracyMeters: 25,
      capturedAt: "2026-07-24T10:00:00.000+08:00",
      coordinateSystem: "gcj02",
      source: "simulated",
    },
  },
  {
    profile: {
      id: "lin",
      displayName: "K",
      avatar: "sky",
      interests: ["宠物友好", "陶艺 / 手作", "citywalk"],
      discoverable: true,
      discoveryRadiusMeters: 800,
      distancePrecision: "region",
    },
    location: {
      latitude: 30.293364,
      longitude: 120.005427,
      accuracyMeters: 32,
      capturedAt: "2026-07-24T10:00:00.000+08:00",
      coordinateSystem: "gcj02",
      source: "simulated",
    },
  },
  {
    profile: {
      id: "mori",
      displayName: "小满",
      avatar: "violet",
      interests: ["植物", "citywalk", "手作"],
      discoverable: true,
      discoveryRadiusMeters: 1_500,
      distancePrecision: "100m",
    },
    location: {
      latitude: 30.272409,
      longitude: 120.005407,
      accuracyMeters: 28,
      capturedAt: "2026-07-24T10:00:00.000+08:00",
      coordinateSystem: "gcj02",
      source: "simulated",
    },
  },
];
