import { load as loadAmap } from "@amap/amap-jsapi-loader";
import {
  Layers,
  LocateFixed,
  Minus,
  Navigation,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

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
import { readAmapConfigFromViteEnv } from "./mapConfig.ts";
import {
  HUPAN_MAP_CENTER,
  createMapFocusTarget,
  diffMapMarkers,
  type DynamicMapMarker,
  type MapFocusRequest,
} from "./mapModel.ts";

interface AmapNearbyMapProps {
  focusRequest: MapFocusRequest;
  markers: DynamicMapMarker[];
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
) {
  const button = document.createElement("button");
  const dot = document.createElement("span");
  const label = document.createElement("span");

  button.type = "button";
  button.setAttribute("aria-label", marker.accessibilityLabel);
  button.setAttribute("aria-pressed", String(marker.selected));
  button.style.cssText = [
    "align-items:center",
    `background:${marker.selected ? "#fff9ed" : "#263f3e"}`,
    `border:${marker.selected ? "3px solid #ff7f72" : "2px solid rgba(255,255,255,.92)"}`,
    "border-radius:999px",
    "box-shadow:0 6px 18px rgba(16,39,38,.34)",
    "color:#fff9ed",
    "cursor:pointer",
    "display:flex",
    "font:700 12px/1 Inter,system-ui,sans-serif",
    "gap:6px",
    "min-height:44px",
    "min-width:44px",
    "padding:5px 10px 5px 6px",
    "white-space:nowrap",
  ].join(";");

  dot.style.cssText = [
    `background:${AVATAR_COLORS[marker.avatar]}`,
    `border:${marker.isSelf ? "3px double #263f3e" : "2px solid #263f3e"}`,
    "border-radius:999px",
    "display:block",
    "height:26px",
    "width:26px",
  ].join(";");
  label.textContent = marker.isSelf ? "我" : marker.displayName;
  button.append(dot, label);

  const handlers = createMarkerSelectionHandlers(marker.id, onSelectPlayer);
  button.addEventListener("click", handlers.onDomClick);

  return {
    element: button,
    onMarkerClick: handlers.onMarkerClick,
    dispose: () => button.removeEventListener("click", handlers.onDomClick),
  };
}

export default function AmapNearbyMap({
  focusRequest,
  markers,
  sourceLabel,
  onSelectPlayer,
}: AmapNearbyMapProps) {
  const reactId = useId();
  const containerId = useMemo(
    () => `nearby-amap-${reactId.replaceAll(":", "")}`,
    [reactId],
  );
  const mapRef = useRef<AMap.Map | null>(null);
  const runtimeRef = useRef<AmapRuntime | null>(null);
  const layersRef = useRef<MapLayerRegistry<AmapMapLayer> | null>(null);
  const mountedMarkersRef = useRef(new Map<string, MountedMarker>());
  const previousMarkersRef = useRef<DynamicMapMarker[]>([]);
  const onSelectPlayerRef = useRef(onSelectPlayer);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [layerMessage, setLayerMessage] = useState("");
  const [zoom, setZoom] = useState(16);
  const [layerMode, setLayerMode] = useState(DEFAULT_MAP_LAYER_MODE);
  const [retryNonce, setRetryNonce] = useState(0);
  const config = useMemo(() => readAmapConfigFromViteEnv(import.meta.env), []);

  useEffect(() => {
    onSelectPlayerRef.current = onSelectPlayer;
  }, [onSelectPlayer]);

  const selectPlayer = useCallback((playerId: string) => {
    onSelectPlayerRef.current(playerId);
  }, []);

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
    window._AMapSecurityConfig = { securityJsCode: config.securityJsCode };

    void loadAmap({ key: config.key, version: "2.0", plugins: [] })
      .then((loadedRuntime: unknown) => {
        if (disposed) return;

        const runtime = loadedRuntime as AmapRuntime;
        const layers = createMapLayerRegistry<AmapMapLayer>({
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
          layers: [layers.standard],
        });

        const initialLayerResult = applyMapLayerMode(
          map,
          layers,
          DEFAULT_MAP_LAYER_MODE,
        );
        zoomChangeHandler = () => setZoom(Math.round(map.getZoom() * 10) / 10);
        map.on("zoomchange", zoomChangeHandler);
        mapRef.current = map;
        runtimeRef.current = runtime;
        layersRef.current = layers;
        setLayerMode(initialLayerResult.mode);
        setLayerMessage((current) => updateMapLayerMessage(current, initialLayerResult));
        setZoom(map.getZoom());
        setStatus("ready");
      })
      .catch(() => {
        if (disposed) return;
        setErrorMessage(navigator.onLine
          ? "地图加载失败，请检查高德域名白名单与安全配置"
          : "网络已断开，地图暂时不可用");
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
      layersRef.current = null;
    };
  }, [config, containerId, retryNonce]);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (status !== "ready" || !map || !layers) return;

    try {
      const result = applyMapLayerMode(map, layers, layerMode);
      setLayerMessage((current) => updateMapLayerMessage(current, result));
      if (result.mode !== layerMode) setLayerMode(result.mode);
    } catch {
      setErrorMessage("地图图层切换失败，请重新加载地图");
      setStatus("error");
    }
  }, [layerMode, status]);

  useEffect(() => {
    const map = mapRef.current;
    const runtime = runtimeRef.current;
    if (status !== "ready" || !map || !runtime) return;

    const diff = diffMapMarkers(previousMarkersRef.current, markers);
    const removeIds = [...diff.removeIds, ...diff.update.map((marker) => marker.id)];

    for (const id of removeIds) {
      const mounted = mountedMarkersRef.current.get(id);
      if (!mounted) continue;
      mounted.dispose();
      mounted.marker.remove();
      mountedMarkersRef.current.delete(id);
    }

    for (const markerModel of [...diff.add, ...diff.update]) {
      const markerElement = createMarkerElement(markerModel, selectPlayer);
      const marker = new runtime.Marker({
        position: markerModel.position,
        offset: markerModel.visualOffset,
        content: markerElement.element,
        anchor: "bottom-center",
        title: markerModel.accessibilityLabel,
        zIndex: markerModel.selected ? 120 : markerModel.isSelf ? 110 : 100,
      });
      marker.on("click", markerElement.onMarkerClick);
      map.add(marker);
      mountedMarkersRef.current.set(markerModel.id, {
        marker,
        dispose: () => {
          marker.off("click", markerElement.onMarkerClick);
          markerElement.dispose();
        },
      });
    }
    previousMarkersRef.current = markers;
  }, [markers, selectPlayer, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    const target = createMapFocusTarget(focusRequest, markers);
    if (!target) return;
    if (target.zoom === undefined) map.panTo(target.center, 350);
    else map.setZoomAndCenter(target.zoom, target.center, false, 350);
  }, [focusRequest, markers, status]);

  const runMapAction = (action: (map: AMap.Map) => void) => {
    if (mapRef.current) action(mapRef.current);
  };

  const focusSelf = () => {
    const target = createMapFocusTarget({ kind: "self" }, markers);
    if (target) {
      runMapAction((map) => map.setZoomAndCenter(target.zoom ?? 17, target.center, false, 350));
    }
  };

  const unavailable = status === "missing-config" || status === "error";

  return (
    <div className="amap-shell">
      <div id={containerId} className="amap-canvas" aria-label="附近的人动态地图" />

      {status === "loading" && (
        <div className="amap-message" role="status">
          <span className="amap-spinner" />
          <strong>正在加载动态地图</strong>
        </div>
      )}

      {unavailable && (
        <div className="amap-message" role="status">
          <strong>{status === "missing-config" ? "尚未配置高德地图" : "地图暂时不可用"}</strong>
          <span>{status === "missing-config"
            ? `缺少 ${config.status === "missing" ? config.missing.join("、") : "高德配置"}；附近的人列表仍可使用。`
            : `${errorMessage}；附近的人列表仍可使用。`}</span>
          {status === "error" && (
            <button type="button" className="map-command" onClick={() => setRetryNonce((value) => value + 1)}><RefreshCw size={16} /> 重试</button>
          )}
        </div>
      )}

      {status === "ready" && (
        <>
          {layerMessage && <div className="amap-warning" role="status">{layerMessage}</div>}
          <div className="amap-zoom-controls">
            <MapControl label="放大地图" onClick={() => runMapAction((map) => map.zoomIn())}><Plus size={19} /></MapControl>
            <MapControl label="缩小地图" onClick={() => runMapAction((map) => map.zoomOut())}><Minus size={19} /></MapControl>
          </div>
          <div className="amap-location-controls">
            <MapControl label={getMapLayerToggleLabel(layerMode)} selected={layerMode === "satellite"} onClick={() => setLayerMode(toggleMapLayerMode)}><Layers size={18} /></MapControl>
            <MapControl label="回到湖畔中心" onClick={() => runMapAction((map) => map.setZoomAndCenter(16, HUPAN_MAP_CENTER, false, 350))}><Navigation size={18} /></MapControl>
            <MapControl label="定位到我的位置" onClick={focusSelf}><LocateFixed size={18} /></MapControl>
          </div>
          <div className="amap-status">{layerMode === "satellite" ? "卫星" : "标准"} · {sourceLabel} · Z{zoom}</div>
        </>
      )}
    </div>
  );
}

function MapControl({
  children,
  label,
  onClick,
  selected = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <button type="button" className={`map-control ${selected ? "map-control-selected" : ""}`} aria-label={label} aria-pressed={selected} title={label} onClick={onClick}>
      {children}
    </button>
  );
}
