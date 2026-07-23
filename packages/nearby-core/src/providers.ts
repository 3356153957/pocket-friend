import type {
  Coordinate,
  GeoPoint,
  LocationProvider,
  PixelMapDefinition,
  PresenceRepository,
  PresenceSnapshot,
} from "./types.ts";

export interface SimulatedLocationProviderOptions {
  path: Coordinate[];
  capturedAt?: () => string;
  accuracyMeters?: number;
}

export interface SimulatedLocationProviderDefaults {
  capturedAt?: () => string;
  accuracyMeters?: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneSnapshot(snapshot: PresenceSnapshot): PresenceSnapshot {
  return {
    profile: {
      ...snapshot.profile,
      interests: [...snapshot.profile.interests],
    },
    location: { ...snapshot.location },
  };
}

export class SimulatedLocationProvider implements LocationProvider {
  readonly source = "simulated";

  private index = 0;
  private readonly path: Coordinate[];
  private readonly capturedAt: () => string;
  private readonly accuracyMeters: number;
  private readonly listeners = new Set<(location: GeoPoint) => void>();

  constructor(options: SimulatedLocationProviderOptions) {
    if (options.path.length === 0) {
      throw new Error("SimulatedLocationProvider requires at least one path point.");
    }

    this.path = options.path.map((point) => ({ ...point }));
    this.capturedAt = options.capturedAt ?? nowIso;
    this.accuracyMeters = options.accuracyMeters ?? 20;
  }

  static fromMap(
    map: PixelMapDefinition,
    defaults: SimulatedLocationProviderDefaults = {},
  ): SimulatedLocationProvider {
    const options: SimulatedLocationProviderOptions = {
      path: map.landmarks.map((landmark) => ({
        latitude: landmark.latitude,
        longitude: landmark.longitude,
      })),
    };

    if (defaults.capturedAt) {
      options.capturedAt = defaults.capturedAt;
    }

    if (defaults.accuracyMeters !== undefined) {
      options.accuracyMeters = defaults.accuracyMeters;
    }

    return new SimulatedLocationProvider(options);
  }

  async getCurrentLocation(): Promise<GeoPoint> {
    return this.currentLocation();
  }

  private currentLocation(): GeoPoint {
    const point = this.path[this.index]!;

    return {
      latitude: point.latitude,
      longitude: point.longitude,
      accuracyMeters: this.accuracyMeters,
      capturedAt: this.capturedAt(),
      coordinateSystem: "gcj02",
      source: "simulated",
    };
  }

  async watchLocation(listener: (location: GeoPoint) => void): Promise<() => void> {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  advance(): GeoPoint {
    this.index = (this.index + 1) % this.path.length;
    const location = this.currentLocation();

    for (const listener of this.listeners) {
      listener(location);
    }

    return location;
  }
}

export class InMemoryPresenceRepository implements PresenceRepository {
  private readonly snapshots = new Map<string, PresenceSnapshot>();
  private readonly listeners = new Set<(snapshots: PresenceSnapshot[]) => void>();

  async publish(snapshot: PresenceSnapshot): Promise<void> {
    this.snapshots.set(snapshot.profile.id, cloneSnapshot(snapshot));
    this.emit();
  }

  async list(): Promise<PresenceSnapshot[]> {
    return [...this.snapshots.values()].map(cloneSnapshot);
  }

  subscribe(listener: (snapshots: PresenceSnapshot[]) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async remove(playerId: string): Promise<void> {
    this.snapshots.delete(playerId);
    this.emit();
  }

  private emit(): void {
    const snapshots = [...this.snapshots.values()].map(cloneSnapshot);

    for (const listener of this.listeners) {
      listener(snapshots);
    }
  }
}
