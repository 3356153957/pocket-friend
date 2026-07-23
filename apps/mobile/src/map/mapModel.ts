import type { PixelAvatar } from "../../../../packages/nearby-core/src/index.ts";
import type { VisiblePlayer } from "../nearbyGame.ts";

export type MapPosition = [longitude: number, latitude: number];
export type MapPixelOffset = [x: number, y: number];

export interface DynamicMapMarker {
  id: string;
  displayName: string;
  avatar: PixelAvatar;
  position: MapPosition;
  visualOffset: MapPixelOffset;
  isSelf: boolean;
  selected: boolean;
  accessibilityLabel: string;
}

export type MapFocusRequest =
  | { kind: "hupan"; nonce?: number }
  | { kind: "self"; nonce?: number }
  | { kind: "player"; playerId: string; nonce?: number };

export interface MapFocusTarget {
  center: MapPosition;
  zoom?: number;
}

export interface MapMarkerDiff {
  add: DynamicMapMarker[];
  update: DynamicMapMarker[];
  removeIds: string[];
}

export const HUPAN_MAP_CENTER: MapPosition = [120.007986, 30.293312];

function isValidPosition(longitude: number, latitude: number): boolean {
  return Number.isFinite(longitude)
    && Number.isFinite(latitude)
    && longitude >= -180
    && longitude <= 180
    && latitude >= -90
    && latitude <= 90;
}

export function buildMapMarkers(
  players: VisiblePlayer[],
  selectedPlayerId: string | null,
): DynamicMapMarker[] {
  const markers = players.flatMap((player) => {
    const { longitude, latitude } = player.location;
    if (!isValidPosition(longitude, latitude)) {
      return [];
    }

    const selected = player.id === selectedPlayerId;
    const role = player.isSelf ? "当前位置" : "附近的人";
    return [{
      id: player.id,
      displayName: player.displayName,
      avatar: player.avatar,
      position: [longitude, latitude] as MapPosition,
      visualOffset: [0, 0] as MapPixelOffset,
      isSelf: player.isSelf,
      selected,
      accessibilityLabel: `${player.displayName}，${role}${selected ? "，已选中" : ""}`,
    }];
  });

  const markersByPosition = new Map<string, DynamicMapMarker[]>();
  for (const marker of markers) {
    const key = marker.position.join(",");
    const group = markersByPosition.get(key) ?? [];
    group.push(marker);
    markersByPosition.set(key, group);
  }

  return markers.map((marker) => {
    const group = markersByPosition.get(marker.position.join(","))!;
    if (group.length === 1) {
      return marker;
    }

    const index = group.indexOf(marker);
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / group.length;
    return {
      ...marker,
      visualOffset: [
        Math.round(Math.cos(angle) * 48),
        Math.round(Math.sin(angle) * 48),
      ],
    };
  });
}

export function createMapFocusTarget(
  request: MapFocusRequest,
  markers: DynamicMapMarker[],
): MapFocusTarget | null {
  if (request.kind === "hupan") {
    return { center: HUPAN_MAP_CENTER, zoom: 16 };
  }

  const marker = request.kind === "self"
    ? markers.find((candidate) => candidate.isSelf)
    : markers.find((candidate) => candidate.id === request.playerId);

  if (!marker) {
    return null;
  }

  return {
    center: marker.position,
    ...(request.kind === "self" ? { zoom: 17 } : {}),
  };
}

export function diffMapMarkers(
  previous: DynamicMapMarker[],
  next: DynamicMapMarker[],
): MapMarkerDiff {
  const previousById = new Map(previous.map((marker) => [marker.id, marker]));
  const nextById = new Map(next.map((marker) => [marker.id, marker]));

  return {
    add: next.filter((marker) => !previousById.has(marker.id)),
    update: next.filter((marker) => {
      const before = previousById.get(marker.id);
      return before !== undefined && JSON.stringify(before) !== JSON.stringify(marker);
    }),
    removeIds: previous
      .filter((marker) => !nextById.has(marker.id))
      .map((marker) => marker.id),
  };
}
