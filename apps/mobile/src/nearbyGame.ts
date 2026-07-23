import {
  findNearbyMatches,
  HUPAN_PIXEL_MAP,
  projectToPixelMap,
  toGcj02,
  type GeoPoint,
  type NearbyMatch,
  type PixelPoint,
  type PlayerProfile,
  type PresenceSnapshot,
} from "../../../packages/nearby-core/src/index.ts";

export const HUPAN_FIXED_SELF_LOCATION: GeoPoint = {
  latitude: 30.293312,
  longitude: 120.007986,
  accuracyMeters: 10,
  capturedAt: "2026-07-23T00:00:00.000+08:00",
  coordinateSystem: "gcj02",
  source: "native",
};

export interface CreateNearbyGameStateInput {
  currentPlayer: PlayerProfile;
  currentLocation: GeoPoint;
  presences: PresenceSnapshot[];
  now?: Date;
}

export interface VisiblePlayer {
  id: string;
  displayName: string;
  avatar: PlayerProfile["avatar"];
  pixel: PixelPoint;
  location: GeoPoint;
  sourceLabel: string;
  isSelf: boolean;
}

export interface NearbyGameState {
  self: PlayerProfile;
  visiblePlayers: VisiblePlayer[];
  nearbyMatches: NearbyMatch[];
  statusText: string;
}

function sourceLabel(source: GeoPoint["source"]): string {
  if (source === "native" || source === "jacoo") {
    return "GPS";
  }

  return "SIM";
}

function normalizeSnapshot(snapshot: PresenceSnapshot): PresenceSnapshot {
  return {
    profile: snapshot.profile,
    location: toGcj02(snapshot.location),
  };
}

function visiblePlayer(profile: PlayerProfile, location: GeoPoint, isSelf: boolean): VisiblePlayer {
  const normalizedLocation = toGcj02(location);

  return {
    id: profile.id,
    displayName: profile.displayName,
    avatar: profile.avatar,
    pixel: projectToPixelMap(normalizedLocation, HUPAN_PIXEL_MAP),
    location: normalizedLocation,
    sourceLabel: sourceLabel(location.source),
    isSelf,
  };
}

export function createNearbyGameState(input: CreateNearbyGameStateInput): NearbyGameState {
  const now = input.now ?? new Date();
  const normalizedSelfLocation: GeoPoint = {
    ...HUPAN_FIXED_SELF_LOCATION,
    capturedAt: input.currentLocation.capturedAt,
    source: input.currentLocation.source,
  };
  const normalizedPresences = input.presences.map(normalizeSnapshot);
  const nearbyMatches = findNearbyMatches({
    me: input.currentPlayer,
    myLocation: normalizedSelfLocation,
    candidates: normalizedPresences,
    now,
  });
  const closest = nearbyMatches[0];

  return {
    self: input.currentPlayer,
    visiblePlayers: [
      visiblePlayer(input.currentPlayer, normalizedSelfLocation, true),
      ...normalizedPresences.map((presence) => visiblePlayer(presence.profile, presence.location, false)),
    ],
    nearbyMatches,
    statusText: closest ? `最近: ${closest.player.displayName}, ${closest.displayDistance}` : "附近暂时没有匹配的人",
  };
}
