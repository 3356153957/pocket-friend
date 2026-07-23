export interface ProximityEvent {
  playerId: string;
  type: "entered" | "exited";
  distanceMeters: number;
}

export class ProximityTracker {
  readonly #inside = new Set<string>();
  readonly radiusMeters: number;

  constructor(radiusMeters: number) {
    if (radiusMeters <= 0) {
      throw new RangeError("radiusMeters must be greater than zero");
    }
    this.radiusMeters = radiusMeters;
  }

  update(playerId: string, distanceMeters: number, locationQualitySufficient: boolean): ProximityEvent | undefined {
    if (!locationQualitySufficient) {
      return undefined;
    }

    const wasInside = this.#inside.has(playerId);
    const isInside = distanceMeters <= this.radiusMeters;
    if (isInside === wasInside) {
      return undefined;
    }

    if (isInside) {
      this.#inside.add(playerId);
      return { playerId, type: "entered", distanceMeters };
    }

    this.#inside.delete(playerId);
    return { playerId, type: "exited", distanceMeters };
  }

  reset(playerId?: string): void {
    if (playerId) {
      this.#inside.delete(playerId);
      return;
    }
    this.#inside.clear();
  }
}
