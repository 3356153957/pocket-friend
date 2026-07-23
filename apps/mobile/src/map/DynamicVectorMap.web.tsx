import { load as loadAmap } from "@amap/amap-jsapi-loader";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  DynamicMapMarker,
  MapFocusRequest,
} from "./mapModel.ts";
import {
  HUPAN_MAP_CENTER,
  createMapFocusTarget,
  diffMapMarkers,
} from "./mapModel.ts";
import { readAmapConfig } from "./mapConfig.ts";
import { createMarkerSelectionHandlers } from "./mapInteraction.ts";
import {
  DEFAULT_MAP_LAYER_MODE,
  applyMapLayerMode,
  createMapLayerRegistry,
  getMapLayerToggleLabel,
  toggleMapLayerMode,
  updateMapLayerMessage,
  type MapLayerRegistry,
} from "./mapLayers.ts";

export interface DynamicVectorMapProps {
  markers: DynamicMapMarker[];
  focusRequest: MapFocusRequest;
  sourceLabel: string;
  onSelectPlayer: (playerId: string) => void;
}

type MapStatus = "loading" | "ready" | "missing-config" | "error";

interface AmapRuntime {
  Map: typeof AMap.Map;
  Marker: typeof AMap.Marker;
  TileLayer: typeof AMap.TileLayer;
  createDefaultLayer: typeof AMap.createDefaultLayer;
}

type AmapMapLayer =
  | ReturnType<typeof AMap.createDefaultLayer>
  | InstanceType<typeof AMap.TileLayer.Satellite>
  | InstanceType<typeof AMap.TileLayer.RoadNet>;

interface MountedMarker {
  marker: AMap.Marker;
  dispose: () => void;
}

const AVATAR_COLORS: Record<DynamicMapMarker["avatar"], string> = {
  mint: "#69f0ae",
  coral: "#ff7f72",
  sun: "#ffd166",
  sky: "#6ecbff",
  violet: "#b7a1ff",
};

function createMarkerElement(
  marker: DynamicMapMarker,
  onSelectPlayer: (playerId: string) => void,
): {
  element: HTMLButtonElement;
  onMarkerClick: () => void;
  dispose: () => void;
} {
  const button = document.createElement("button");
  const dot = document.createElement("span");
  const label = document.createElement("span");

  button.type = "button";
  button.setAttribute("aria-label", marker.accessibilityLabel);
  button.setAttribute("aria-pressed", String(marker.selected));
  button.style.alignItems = "center";
  button.style.background = marker.selected ? "#f8fbff" : "#111922";
  button.style.border = marker.selected
    ? "3px solid #111922"
    : "2px solid rgba(248, 251, 255, 0.9)";
  button.style.borderRadius = "999px";
  button.style.boxShadow = marker.selected
    ? "0 0 0 4px rgba(105, 240, 174, 0.9), 0 8px 20px rgba(0, 0, 0, 0.4)"
    : "0 5px 14px rgba(0, 0, 0, 0.36)";
  button.style.color = marker.selected ? "#111922" : "#f8fbff";
  button.style.cursor = "pointer";
  button.style.display = "flex";
  button.style.font = "700 12px/1 system-ui, sans-serif";
  button.style.gap = "6px";
  button.style.minHeight = "44px";
  button.style.minWidth = "44px";
  button.style.padding = "5px 9px 5px 6px";
  button.style.whiteSpace = "nowrap";

  dot.style.background = AVATAR_COLORS[marker.avatar];
  dot.style.border = marker.isSelf ? "3px double #111922" : "2px solid #111922";
  dot.style.borderRadius = "999px";
  dot.style.display = "block";
  dot.style.height = "26px";
  dot.style.width = "26px";

  label.textContent = marker.isSelf ? "我" : marker.displayName;
  button.append(dot, label);

  const selectionHandlers = createMarkerSelectionHandlers(
    marker.id,
    onSelectPlayer,
  );
  button.addEventListener("click", selectionHandlers.onDomClick);

  return {
    element: button,
    onMarkerClick: selectionHandlers.onMarkerClick,
    dispose: () => {
      button.removeEventListener("click", selectionHandlers.onDomClick);
    },
  };
}

export default function DynamicVectorMap({
  markers,
  focusRequest,
  sourceLabel,
  onSelectPlayer,
}: DynamicVectorMapProps) {
  const reactId = useId();
  const containerId = useMemo(
    () => `nearby-amap-${reactId.replaceAll(":", "")}`,
    [reactId],
  );
  const mapRef = useRef<AMap.Map | null>(null);
  const runtimeRef = useRef<AmapRuntime | null>(null);
  const mapLayersRef =
    useRef<MapLayerRegistry<AmapMapLayer> | null>(null);
  const mountedMarkersRef = useRef(new Map<string, MountedMarker>());
  const previousMarkersRef = useRef<DynamicMapMarker[]>([]);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [layerMessage, setLayerMessage] = useState("");
  const [zoom, setZoom] = useState(16);
  const [layerMode, setLayerMode] = useState(DEFAULT_MAP_LAYER_MODE);
  const [retryNonce, setRetryNonce] = useState(0);
  const config = useMemo(
    () => readAmapConfig({
      EXPO_PUBLIC_AMAP_KEY: process.env.EXPO_PUBLIC_AMAP_KEY,
      EXPO_PUBLIC_AMAP_SECURITY_JS_CODE:
        process.env.EXPO_PUBLIC_AMAP_SECURITY_JS_CODE,
    }),
    [],
  );

  useEffect(() => {
    if (config.status === "missing") {
      setStatus("missing-config");
      return;
    }

    let disposed = false;
    let zoomChangeHandler: (() => void) | undefined;
    setStatus("loading");
    setErrorMessage("");
    setLayerMessage("");

    window._AMapSecurityConfig = {
      securityJsCode: config.securityJsCode,
    };

    void loadAmap({
      key: config.key,
      version: "2.0",
      plugins: [],
    })
      .then((loadedRuntime: unknown) => {
        if (disposed) {
          return;
        }

        const runtime = loadedRuntime as AmapRuntime;
        const mapLayers = createMapLayerRegistry<AmapMapLayer>({
          createStandard: () => runtime.createDefaultLayer(),
          createSatellite: () => new runtime.TileLayer.Satellite(),
          createRoadnet: () => new runtime.TileLayer.RoadNet(),
        });
        const map = new runtime.Map(containerId, {
          center: HUPAN_MAP_CENTER,
          zoom: 16,
          viewMode: "3D",
          pitch: 0,
          rotation: 0,
          pitchEnable: true,
          rotateEnable: true,
          dragEnable: true,
          scrollWheel: true,
          touchZoom: true,
          keyboardEnable: true,
          layers: [mapLayers.standard],
        });
        let initialLayerResult;
        try {
          initialLayerResult = applyMapLayerMode(
            map,
            mapLayers,
            DEFAULT_MAP_LAYER_MODE,
          );
        } catch (error) {
          map.destroy();
          throw error;
        }

        zoomChangeHandler = () => setZoom(Math.round(map.getZoom() * 10) / 10);
        map.on("zoomchange", zoomChangeHandler);
        mapRef.current = map;
        runtimeRef.current = runtime;
        mapLayersRef.current = mapLayers;
        setLayerMode(initialLayerResult.mode);
        setLayerMessage((current) => (
          updateMapLayerMessage(current, initialLayerResult)
        ));
        setZoom(map.getZoom());
        setStatus("ready");
      })
      .catch(() => {
        if (disposed) {
          return;
        }

        setErrorMessage(
          navigator.onLine
            ? "地图加载失败，请检查高德域名白名单与安全配置"
            : "网络已断开，地图暂时不可用",
        );
        setStatus("error");
      });

    return () => {
      disposed = true;
      for (const mounted of mountedMarkersRef.current.values()) {
        mounted.dispose();
        mounted.marker.remove();
      }
      mountedMarkersRef.current.clear();
      previousMarkersRef.current = [];

      if (mapRef.current && zoomChangeHandler) {
        mapRef.current.off("zoomchange", zoomChangeHandler);
      }
      mapRef.current?.destroy();
      mapRef.current = null;
      runtimeRef.current = null;
      mapLayersRef.current = null;
    };
  }, [config, containerId, retryNonce]);

  useEffect(() => {
    const map = mapRef.current;
    const layers = mapLayersRef.current;
    if (status !== "ready" || !map || !layers) {
      return;
    }

    try {
      const result = applyMapLayerMode(map, layers, layerMode);
      setLayerMessage((current) => updateMapLayerMessage(current, result));
      if (result.mode !== layerMode) {
        setLayerMode(result.mode);
      }
    } catch {
      setErrorMessage("地图图层切换失败，请重新加载地图");
      setStatus("error");
    }
  }, [layerMode, status]);

  useEffect(() => {
    const map = mapRef.current;
    const runtime = runtimeRef.current;
    if (status !== "ready" || !map || !runtime) {
      return;
    }

    const diff = diffMapMarkers(previousMarkersRef.current, markers);
    const removeIds = [...diff.removeIds, ...diff.update.map((marker) => marker.id)];

    for (const id of removeIds) {
      const mounted = mountedMarkersRef.current.get(id);
      if (!mounted) {
        continue;
      }
      mounted.dispose();
      mounted.marker.remove();
      mountedMarkersRef.current.delete(id);
    }

    for (const markerModel of [...diff.add, ...diff.update]) {
      const { element, onMarkerClick, dispose: disposeElement } = createMarkerElement(
        markerModel,
        onSelectPlayer,
      );
      const marker = new runtime.Marker({
        position: markerModel.position,
        offset: markerModel.visualOffset,
        content: element,
        anchor: "bottom-center",
        title: markerModel.accessibilityLabel,
        zIndex: markerModel.selected ? 120 : markerModel.isSelf ? 110 : 100,
      });
      marker.on("click", onMarkerClick);
      map.add(marker);
      mountedMarkersRef.current.set(markerModel.id, {
        marker,
        dispose: () => {
          marker.off("click", onMarkerClick);
          disposeElement();
        },
      });
    }

    previousMarkersRef.current = markers;
  }, [markers, onSelectPlayer, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) {
      return;
    }

    const target = createMapFocusTarget(focusRequest, markers);
    if (!target) {
      return;
    }

    if (target.zoom === undefined) {
      map.panTo(target.center, 350);
    } else {
      map.setZoomAndCenter(target.zoom, target.center, false, 350);
    }
  }, [focusRequest, status]);

  const runMapAction = (action: (map: AMap.Map) => void) => {
    const map = mapRef.current;
    if (map) {
      action(map);
    }
  };

  const focusSelf = () => {
    const target = createMapFocusTarget({ kind: "self" }, markers);
    if (target) {
      runMapAction((map) => {
        map.setZoomAndCenter(target.zoom ?? 17, target.center, false, 350);
      });
    }
  };

  const mapUnavailable = status === "missing-config" || status === "error";

  return (
    <View style={styles.shell}>
      <View nativeID={containerId} style={styles.map} />

      {status === "loading" ? (
        <View accessibilityLiveRegion="polite" style={styles.messageCard}>
          <ActivityIndicator color="#69f0ae" />
          <Text style={styles.messageTitle}>正在加载动态地图</Text>
        </View>
      ) : null}

      {mapUnavailable ? (
        <View accessibilityLiveRegion="polite" style={styles.messageCard}>
          <Text style={styles.messageTitle}>
            {status === "missing-config" ? "尚未配置高德地图" : "地图暂时不可用"}
          </Text>
          <Text style={styles.messageDetail}>
            {status === "missing-config"
              ? "请在网页环境变量中配置高德 Key 与安全密钥；附近的人列表仍可使用。"
              : `${errorMessage}；附近的人列表仍可使用。`}
          </Text>
          {status === "error" ? (
            <Pressable
              accessibilityLabel="重新加载地图"
              accessibilityRole="button"
              onPress={() => setRetryNonce((value) => value + 1)}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.controlPressed,
              ]}
            >
              <Text style={styles.retryText}>重试</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {status === "ready" ? (
        <>
          {layerMessage ? (
            <View accessibilityLiveRegion="polite" style={styles.layerWarning}>
              <Text style={styles.layerWarningText}>{layerMessage}</Text>
            </View>
          ) : null}
          <View style={styles.zoomControls}>
            <MapControl
              label="放大地图"
              text="+"
              onPress={() => runMapAction((map) => map.zoomIn())}
            />
            <MapControl
              label="缩小地图"
              text="−"
              onPress={() => runMapAction((map) => map.zoomOut())}
            />
          </View>
          <View style={styles.locationControls}>
            <MapControl
              label={getMapLayerToggleLabel(layerMode)}
              selected={layerMode === "satellite"}
              text={layerMode === "satellite" ? "卫星" : "标准"}
              onPress={() => setLayerMode(toggleMapLayerMode)}
            />
            <MapControl
              label="回到湖畔中心"
              text="湖畔"
              onPress={() => {
                runMapAction((map) => {
                  map.setZoomAndCenter(16, HUPAN_MAP_CENTER, false, 350);
                });
              }}
            />
            <MapControl label="定位到我的位置" text="定位" onPress={focusSelf} />
            <MapControl
              label="地图恢复正北"
              text="北"
              onPress={() => {
                runMapAction((map) => {
                  map.setRotation(0, false, 250);
                  map.setPitch(0, false, 250);
                });
              }}
            />
          </View>
          <View style={styles.statusPill}>
            <Text numberOfLines={1} style={styles.statusText}>
              {sourceLabel} · Z{zoom}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

interface MapControlProps {
  label: string;
  text: string;
  onPress: () => void;
  selected?: boolean;
}

function MapControl({
  label,
  text,
  onPress,
  selected = false,
}: MapControlProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        selected && styles.controlSelected,
        pressed && styles.controlPressed,
      ]}
    >
      <Text style={styles.controlText}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignSelf: "stretch",
    backgroundColor: "#0b1118",
    borderColor: "#33404d",
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 420,
    overflow: "hidden",
    position: "relative",
  },
  map: {
    height: 420,
    width: "100%",
  },
  messageCard: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(11, 17, 24, 0.94)",
    borderColor: "#33404d",
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    justifyContent: "center",
    maxWidth: 360,
    padding: 22,
    position: "absolute",
    top: 110,
    width: "86%",
  },
  messageTitle: {
    color: "#f3f7fb",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  messageDetail: {
    color: "#aab7c4",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  layerWarning: {
    alignSelf: "center",
    backgroundColor: "rgba(255, 216, 77, 0.96)",
    borderColor: "#111922",
    borderRadius: 12,
    borderWidth: 2,
    maxWidth: "62%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: "absolute",
    top: 12,
  },
  layerWarningText: {
    color: "#111922",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: "#69f0ae",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 22,
  },
  retryText: {
    color: "#07150f",
    fontSize: 14,
    fontWeight: "900",
  },
  zoomControls: {
    gap: 8,
    left: 12,
    position: "absolute",
    top: 12,
  },
  locationControls: {
    bottom: 12,
    gap: 8,
    position: "absolute",
    right: 12,
  },
  control: {
    alignItems: "center",
    backgroundColor: "rgba(11, 17, 24, 0.92)",
    borderColor: "rgba(248, 251, 255, 0.72)",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 10,
  },
  controlPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  controlSelected: {
    backgroundColor: "rgba(36, 95, 150, 0.94)",
    borderColor: "#69f0ae",
  },
  controlText: {
    color: "#f8fbff",
    fontSize: 13,
    fontWeight: "900",
  },
  statusPill: {
    backgroundColor: "rgba(11, 17, 24, 0.88)",
    borderColor: "rgba(248, 251, 255, 0.5)",
    borderRadius: 999,
    borderWidth: 1,
    bottom: 12,
    left: 12,
    maxWidth: "55%",
    paddingHorizontal: 11,
    paddingVertical: 8,
    position: "absolute",
  },
  statusText: {
    color: "#f8fbff",
    fontSize: 12,
    fontWeight: "800",
  },
});
