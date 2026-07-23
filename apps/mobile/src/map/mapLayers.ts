export type MapLayerMode = "satellite" | "standard";
export type MapLayerKey = "satellite" | "roadnet" | "standard";

export const DEFAULT_MAP_LAYER_MODE: MapLayerMode = "satellite";
export const MAP_LAYER_FALLBACK_MESSAGE =
  "卫星图层暂时不可用，已切换到标准地图";

export interface MapLayerRegistry<T> {
  standard: T;
  satellite?: T;
  roadnet?: T;
}

export interface MapLayerFactories<T> {
  createStandard(): T;
  createSatellite(): T;
  createRoadnet(): T;
}

export interface MapLayerTarget<T> {
  setLayers(layers: T[]): void;
}

export interface MapLayerApplicationResult {
  mode: MapLayerMode;
  errorMessage: string;
}

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

export function createMapLayerRegistry<T>(
  factories: MapLayerFactories<T>,
): MapLayerRegistry<T> {
  const standard = factories.createStandard();

  try {
    return {
      standard,
      satellite: factories.createSatellite(),
      roadnet: factories.createRoadnet(),
    };
  } catch {
    return { standard };
  }
}

export function applyMapLayerMode<T>(
  map: MapLayerTarget<T>,
  registry: MapLayerRegistry<T>,
  requestedMode: MapLayerMode,
): MapLayerApplicationResult {
  if (
    requestedMode === "satellite"
    && registry.satellite
    && registry.roadnet
  ) {
    try {
      map.setLayers([registry.satellite, registry.roadnet]);
      return { mode: "satellite", errorMessage: "" };
    } catch {
      map.setLayers([registry.standard]);
      return {
        mode: "standard",
        errorMessage: MAP_LAYER_FALLBACK_MESSAGE,
      };
    }
  }

  map.setLayers([registry.standard]);
  return {
    mode: "standard",
    errorMessage:
      requestedMode === "satellite" ? MAP_LAYER_FALLBACK_MESSAGE : "",
  };
}

export function updateMapLayerMessage(
  currentMessage: string,
  result: MapLayerApplicationResult,
): string {
  if (result.errorMessage) {
    return result.errorMessage;
  }

  return result.mode === "satellite" ? "" : currentMessage;
}
