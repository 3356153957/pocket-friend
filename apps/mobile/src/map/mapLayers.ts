export type MapLayerMode = "satellite" | "standard";
export type MapLayerKey = "satellite" | "roadnet" | "standard";

export const DEFAULT_MAP_LAYER_MODE: MapLayerMode = "satellite";

export function getMapLayerKeys(mode: MapLayerMode): MapLayerKey[] {
  return mode === "satellite"
    ? ["satellite", "roadnet"]
    : ["standard"];
}

export function toggleMapLayerMode(mode: MapLayerMode): MapLayerMode {
  return mode === "satellite" ? "standard" : "satellite";
}

export function getMapLayerToggleLabel(mode: MapLayerMode): string {
  return mode === "satellite" ? "切换到标准地图" : "切换到卫星地图";
}
