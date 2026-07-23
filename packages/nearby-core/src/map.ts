import type { Coordinate, PixelMapDefinition, PixelPoint } from "./types.ts";

export const HUPAN_PIXEL_MAP: PixelMapDefinition = {
  id: "hupan-demo",
  name: "湖畔创研中心",
  width: 360,
  height: 520,
  bounds: {
    north: 30.2965,
    south: 30.2705,
    west: 120.0025,
    east: 120.019,
  },
  landmarks: [
    {
      id: "hupan",
      name: "湖畔创研中心",
      shortName: "湖畔",
      kind: "hub",
      longitude: 120.007986,
      latitude: 30.293312,
    },
    {
      id: "dream-town",
      name: "梦想小镇互联网村",
      shortName: "梦想小镇",
      kind: "office",
      longitude: 120.00487,
      latitude: 30.292227,
    },
    {
      id: "cangnan-t1",
      name: "仓南广场 T1",
      shortName: "仓南 T1",
      kind: "plaza",
      longitude: 120.005407,
      latitude: 30.272409,
    },
    {
      id: "qixing",
      name: "启行科创中心",
      shortName: "启行科创",
      kind: "office",
      longitude: 120.005427,
      latitude: 30.293364,
    },
    {
      id: "hznu",
      name: "杭师大仓前校区",
      shortName: "杭师大",
      kind: "campus",
      longitude: 120.016255,
      latitude: 30.292797,
    },
  ],
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function projectToPixelMap(point: Coordinate, map: PixelMapDefinition): PixelPoint {
  const isOutOfBounds = point.latitude > map.bounds.north
    || point.latitude < map.bounds.south
    || point.longitude > map.bounds.east
    || point.longitude < map.bounds.west;
  const longitude = clamp(point.longitude, map.bounds.west, map.bounds.east);
  const latitude = clamp(point.latitude, map.bounds.south, map.bounds.north);
  const x = (longitude - map.bounds.west) / (map.bounds.east - map.bounds.west) * map.width;
  const y = (map.bounds.north - latitude) / (map.bounds.north - map.bounds.south) * map.height;

  return { x, y, isOutOfBounds };
}
