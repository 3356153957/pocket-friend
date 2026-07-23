import type { Coordinate } from "../../../packages/nearby-core/src/index.ts";

export interface SatelliteTileInput {
  center: Coordinate;
  zoom: number;
  tileSize: number;
  gridSize: number;
}

export interface SatelliteTile {
  id: string;
  url: string;
  left: number;
  top: number;
  size: number;
}

function longitudeToTileX(longitude: number, zoom: number): number {
  return Math.floor((longitude + 180) / 360 * 2 ** zoom);
}

function latitudeToTileY(latitude: number, zoom: number): number {
  const latitudeRadians = latitude * Math.PI / 180;
  return Math.floor(
    (1 - Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI) / 2 * 2 ** zoom,
  );
}

export function createSatelliteTiles(input: SatelliteTileInput): SatelliteTile[] {
  const centerX = longitudeToTileX(input.center.longitude, input.zoom);
  const centerY = latitudeToTileY(input.center.latitude, input.zoom);
  const offset = Math.floor(input.gridSize / 2);
  const tiles: SatelliteTile[] = [];

  for (let row = 0; row < input.gridSize; row += 1) {
    for (let column = 0; column < input.gridSize; column += 1) {
      const x = centerX + column - offset;
      const y = centerY + row - offset;
      const host = (Math.abs(x + y) % 4) + 1;

      tiles.push({
        id: `${input.zoom}-${x}-${y}`,
        url: `https://webst0${host}.is.autonavi.com/appmaptile?style=6&x=${x}&y=${y}&z=${input.zoom}`,
        left: column * input.tileSize,
        top: row * input.tileSize,
        size: input.tileSize,
      });
    }
  }

  return tiles;
}
