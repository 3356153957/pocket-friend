import type { Coordinate, ConvertedCoordinate, GeoPoint } from "./types.ts";

const EARTH_RADIUS_METERS = 6_371_008.8;
const GCJ_A = 6_378_245.0;
const GCJ_EE = 0.006693421622965943;

function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

function isOutsideChina({ latitude, longitude }: Coordinate): boolean {
  return longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271;
}

function transformLatitude(x: number, y: number): number {
  let result = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  result += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  result += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
  result += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
  return result;
}

function transformLongitude(x: number, y: number): number {
  let result = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  result += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  result += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
  result += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
  return result;
}

export function wgs84ToGcj02(point: Coordinate): ConvertedCoordinate {
  if (isOutsideChina(point)) {
    return { ...point, coordinateSystem: "gcj02" };
  }

  let latitudeDelta = transformLatitude(point.longitude - 105, point.latitude - 35);
  let longitudeDelta = transformLongitude(point.longitude - 105, point.latitude - 35);
  const latitudeRadians = degreesToRadians(point.latitude);
  const magic = 1 - GCJ_EE * Math.sin(latitudeRadians) ** 2;
  const sqrtMagic = Math.sqrt(magic);

  latitudeDelta = latitudeDelta * 180 / ((GCJ_A * (1 - GCJ_EE) / (magic * sqrtMagic)) * Math.PI);
  longitudeDelta = longitudeDelta * 180 / (GCJ_A / sqrtMagic * Math.cos(latitudeRadians) * Math.PI);

  return {
    latitude: point.latitude + latitudeDelta,
    longitude: point.longitude + longitudeDelta,
    coordinateSystem: "gcj02",
  };
}

export function toGcj02(point: GeoPoint): GeoPoint {
  if (point.coordinateSystem === "gcj02") {
    return point;
  }

  return { ...point, ...wgs84ToGcj02(point), coordinateSystem: "gcj02" };
}

export function haversineMeters(from: Coordinate, to: Coordinate): number {
  if (from.latitude === to.latitude && from.longitude === to.longitude) {
    return 0;
  }

  const latitudeDelta = degreesToRadians(to.latitude - from.latitude);
  const longitudeDelta = degreesToRadians(to.longitude - from.longitude);
  const fromLatitude = degreesToRadians(from.latitude);
  const toLatitude = degreesToRadians(to.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
