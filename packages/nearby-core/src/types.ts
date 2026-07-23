export type CoordinateSystem = "wgs84" | "gcj02";
export type LocationSource = "native" | "jacoo" | "simulated";
export type DistancePrecision = "100m" | "500m" | "1km" | "region";
export type PixelAvatar = "mint" | "coral" | "sun" | "sky" | "violet";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface ConvertedCoordinate extends Coordinate {
  coordinateSystem: "gcj02";
}

export interface GeoPoint extends Coordinate {
  accuracyMeters: number;
  capturedAt: string;
  coordinateSystem: CoordinateSystem;
  source: LocationSource;
}

export interface PlayerProfile {
  id: string;
  displayName: string;
  avatar: PixelAvatar;
  interests: string[];
  discoverable: boolean;
  discoveryRadiusMeters: number;
  distancePrecision: DistancePrecision;
}

export interface PresenceSnapshot {
  profile: PlayerProfile;
  location: GeoPoint;
}

export interface NearbyMatch {
  player: PlayerProfile;
  distanceMeters: number;
  displayDistance: string;
  sharedInterests: string[];
  score: number;
  reason: string;
  locationFresh: boolean;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapLandmark extends Coordinate {
  id: string;
  name: string;
  shortName: string;
  kind: "hub" | "office" | "plaza" | "campus";
}

export interface PixelMapDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  bounds: MapBounds;
  landmarks: MapLandmark[];
}

export interface PixelPoint {
  x: number;
  y: number;
  isOutOfBounds: boolean;
}

export interface LocationProvider {
  readonly source: LocationSource;
  getCurrentLocation(): Promise<GeoPoint>;
  watchLocation(listener: (location: GeoPoint) => void): Promise<() => void>;
}

export interface PresenceRepository {
  publish(snapshot: PresenceSnapshot): Promise<void>;
  list(): Promise<PresenceSnapshot[]>;
  subscribe(listener: (snapshots: PresenceSnapshot[]) => void): () => void;
  remove(playerId: string): Promise<void>;
}
