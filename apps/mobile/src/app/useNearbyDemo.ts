import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  HUPAN_PIXEL_MAP,
  SimulatedLocationProvider,
  type GeoPoint,
} from "../../../../packages/nearby-core/src/index.ts";
import type { Prefs } from "./appFlow.ts";
import { DEMO_CURRENT_PLAYER, DEMO_PRESENCES } from "./demoData.ts";
import { createDemoProfile } from "../demoSettings.ts";
import {
  watchBrowserPosition,
  type BrowserGeolocation,
} from "../location/browserGeolocation.ts";
import { createLocationSampler, type LocationSampler } from "../location/locationController.ts";
import { formatLocationAccuracy } from "../location/locationSampling.ts";
import { createNearbyGameState, type NearbyGameState } from "../nearbyGame.ts";

export type LocationMode = "native" | "simulated";

export interface NearbyDemoController {
  loading: boolean;
  location: GeoPoint | null;
  message: string;
  mode: LocationMode;
  state: NearbyGameState | null;
  retryGps: () => Promise<void>;
  useDemoLocation: () => Promise<void>;
}

export function useNearbyDemo(prefs: Prefs): NearbyDemoController {
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [message, setMessage] = useState("正在请求网页定位…");
  const [mode, setMode] = useState<LocationMode>("native");
  const samplerRef = useRef<LocationSampler | null>(null);
  const requestRef = useRef(0);
  const demoProviderRef = useRef<SimulatedLocationProvider | null>(null);

  if (!demoProviderRef.current) {
    demoProviderRef.current = SimulatedLocationProvider.fromMap(HUPAN_PIXEL_MAP, {
      accuracyMeters: 16,
      capturedAt: () => new Date().toISOString(),
    });
  }

  const stopSampling = useCallback(() => {
    requestRef.current += 1;
    samplerRef.current?.cancel();
    samplerRef.current = null;
  }, []);

  const retryGps = useCallback(async () => {
    stopSampling();
    const requestId = requestRef.current;
    setMode("native");
    setLoading(true);
    setMessage("正在提高定位精度…");

    if (!("geolocation" in navigator)) {
      setMessage("当前浏览器不支持定位，请使用演示位置");
      setLoading(false);
      return;
    }

    const sampler = createLocationSampler({
      watch: (onSample, onError) => watchBrowserPosition(
        navigator.geolocation as BrowserGeolocation,
        onSample,
        onError,
      ),
      setTimer: (callback, timeoutMs) => window.setTimeout(callback, timeoutMs),
      clearTimer: (timer) => window.clearTimeout(timer as number),
      onProgress: (nextLocation) => {
        if (requestRef.current !== requestId) return;
        setLocation(nextLocation);
        setMessage(formatLocationAccuracy(nextLocation, "sampling"));
      },
    });
    samplerRef.current = sampler;

    try {
      const nextLocation = await sampler.sample();
      if (requestRef.current !== requestId) return;
      setLocation(nextLocation);
      setMessage(formatLocationAccuracy(nextLocation, "complete"));
    } catch (error) {
      if (requestRef.current !== requestId) return;
      const reason = error instanceof Error ? error.message : "网页定位失败";
      if (reason !== "定位已取消") setMessage(reason);
    } finally {
      if (requestRef.current === requestId) {
        samplerRef.current = null;
        setLoading(false);
      }
    }
  }, [stopSampling]);

  const useDemoLocation = useCallback(async () => {
    stopSampling();
    const requestId = requestRef.current;
    setMode("simulated");
    setLoading(true);

    try {
      const nextLocation = await demoProviderRef.current!.advance();
      if (requestRef.current !== requestId) return;
      setLocation(nextLocation);
      setMessage("演示定位 · 地图已更新");
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [stopSampling]);

  useEffect(() => {
    void retryGps();
    return stopSampling;
  }, [retryGps, stopSampling]);

  const currentPlayer = useMemo(() => createDemoProfile(DEMO_CURRENT_PLAYER, {
    discoverable: true,
    discoveryRadiusMeters: prefs.radius,
    distancePrecision: "100m",
  }), [prefs.radius]);

  const state = useMemo(() => {
    if (!location) return null;
    const capturedAt = new Date().toISOString();
    return createNearbyGameState({
      currentPlayer,
      currentLocation: location,
      presences: DEMO_PRESENCES.map((presence) => ({
        ...presence,
        location: { ...presence.location, capturedAt },
      })),
    });
  }, [currentPlayer, location]);

  return {
    loading,
    location,
    message,
    mode,
    state,
    retryGps,
    useDemoLocation,
  };
}
