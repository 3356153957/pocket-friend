import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  HUPAN_PIXEL_MAP,
  SimulatedLocationProvider,
  type GeoPoint,
  type PlayerProfile,
  type PresenceSnapshot,
} from "../../packages/nearby-core/src/index.ts";
import {
  createDemoProfile,
  DISCOVERY_RADIUS_OPTIONS,
  DISTANCE_PRECISION_OPTIONS,
  getLocationModes,
  type DemoDiscoverySettings,
  type LocationMode,
} from "./src/demoSettings.ts";
import {
  watchBrowserPosition,
  type BrowserGeolocation,
} from "./src/location/browserGeolocation.ts";
import {
  LOCATION_EMPTY_TIMEOUT_MESSAGE,
  LOCATION_SAMPLE_TIMEOUT_MS,
  formatLocationAccuracy,
  hasReachedTargetAccuracy,
  selectBestLocationSample,
  toNativeGeoPoint,
} from "./src/location/locationSampling.ts";
import DynamicVectorMap from "./src/map/DynamicVectorMap";
import {
  buildMapMarkers,
  type MapFocusRequest,
} from "./src/map/mapModel.ts";
import { createNearbyGameState } from "./src/nearbyGame.ts";

const baseCurrentPlayer: PlayerProfile = {
  id: "me",
  displayName: "你",
  avatar: "mint",
  interests: ["8bit", "coffee", "hardware"],
  discoverable: true,
  discoveryRadiusMeters: 800,
  distancePrecision: "100m",
};

const locationModes = getLocationModes();

const demoProvider = SimulatedLocationProvider.fromMap(HUPAN_PIXEL_MAP, {
  capturedAt: () => new Date().toISOString(),
  accuracyMeters: 16,
});
const demoPlayers: PresenceSnapshot[] = [
  {
    profile: {
      id: "ada",
      displayName: "Ada",
      avatar: "coral",
      interests: ["8bit", "music", "coffee"],
      discoverable: true,
      discoveryRadiusMeters: 800,
      distancePrecision: "100m",
    },
    location: {
      latitude: 30.292227,
      longitude: 120.00487,
      accuracyMeters: 25,
      capturedAt: new Date().toISOString(),
      coordinateSystem: "gcj02",
      source: "simulated",
    },
  },
  {
    profile: {
      id: "lin",
      displayName: "Lin",
      avatar: "sky",
      interests: ["hardware", "game"],
      discoverable: true,
      discoveryRadiusMeters: 900,
      distancePrecision: "500m",
    },
    location: {
      latitude: 30.293364,
      longitude: 120.005427,
      accuracyMeters: 32,
      capturedAt: new Date().toISOString(),
      coordinateSystem: "gcj02",
      source: "simulated",
    },
  },
  {
    profile: {
      id: "mori",
      displayName: "Mori",
      avatar: "violet",
      interests: ["reading", "coffee"],
      discoverable: true,
      discoveryRadiusMeters: 600,
      distancePrecision: "region",
    },
    location: {
      latitude: 30.272409,
      longitude: 120.005407,
      accuracyMeters: 28,
      capturedAt: new Date().toISOString(),
      coordinateSystem: "gcj02",
      source: "simulated",
    },
  },
];

const avatarColors: Record<PlayerProfile["avatar"], string> = {
  mint: "#50e3a4",
  coral: "#ff6f61",
  sun: "#ffd84d",
  sky: "#4fb4ff",
  violet: "#9b78ff",
};

export default function App() {
  const [mode, setMode] = useState<LocationMode>("simulated");
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("点击定位，进入附近地图");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [mapFocusRequest, setMapFocusRequest] = useState<MapFocusRequest>({
    kind: "hupan",
    nonce: 0,
  });
  const [settings, setSettings] = useState<DemoDiscoverySettings>({
    discoverable: true,
    discoveryRadiusMeters: 800,
    distancePrecision: "100m",
  });
  const locationSubscriptionRef =
    useRef<Location.LocationSubscription | null>(null);
  const locationTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationAbortRef = useRef<(() => void) | null>(null);
  const locationSessionRef = useRef(0);
  const locateRequestRef = useRef(0);
  const stopNativeSampling = useCallback(() => {
    locationSessionRef.current += 1;
    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;

    if (locationTimerRef.current) {
      clearTimeout(locationTimerRef.current);
      locationTimerRef.current = null;
    }

    const abort = locationAbortRef.current;
    locationAbortRef.current = null;
    abort?.();
  }, []);

  useEffect(() => () => {
    locateRequestRef.current += 1;
    stopNativeSampling();
  }, [stopNativeSampling]);

  const currentPlayer = useMemo(
    () => createDemoProfile(baseCurrentPlayer, settings),
    [settings],
  );

  const state = useMemo(() => {
    if (!location) {
      return null;
    }

    return createNearbyGameState({
      currentPlayer,
      currentLocation: location,
      presences: demoPlayers.map((presence) => ({
        ...presence,
        location: { ...presence.location, capturedAt: new Date().toISOString() },
      })),
    });
  }, [currentPlayer, location]);
  const selectedMatch = state?.nearbyMatches.find(
    (match) => match.player.id === selectedPlayerId,
  ) ?? null;
  const mapMarkers = useMemo(
    () => buildMapMarkers(state?.visiblePlayers ?? [], selectedPlayerId),
    [selectedPlayerId, state?.visiblePlayers],
  );

  function selectPlayer(playerId: string): void {
    if (playerId === currentPlayer.id) {
      setMapFocusRequest((previous) => ({
        kind: "self",
        nonce: (previous.nonce ?? 0) + 1,
      }));
      return;
    }

    setSelectedPlayerId(playerId);
    setMapFocusRequest((previous) => ({
      kind: "player",
      playerId,
      nonce: (previous.nonce ?? 0) + 1,
    }));
  }

  async function sampleNativeLocation(): Promise<GeoPoint> {
    stopNativeSampling();
    const sessionId = locationSessionRef.current;

    const permission = await Location.requestForegroundPermissionsAsync();
    if (sessionId !== locationSessionRef.current) {
      throw new Error("定位已取消");
    }
    if (permission.status !== "granted") {
      throw new Error("定位权限未开启");
    }

    return new Promise<GeoPoint>((resolve, reject) => {
      let best: GeoPoint | null = null;
      let settled = false;

      const finish = (error?: Error) => {
        if (settled) {
          return;
        }
        settled = true;

        if (sessionId === locationSessionRef.current) {
          locationSubscriptionRef.current?.remove();
          locationSubscriptionRef.current = null;
          if (locationTimerRef.current) {
            clearTimeout(locationTimerRef.current);
            locationTimerRef.current = null;
          }
          locationAbortRef.current = null;
        }

        if (error) {
          reject(error);
        } else if (best) {
          resolve(best);
        } else {
          reject(new Error(LOCATION_EMPTY_TIMEOUT_MESSAGE));
        }
      };

      locationAbortRef.current = () => finish(new Error("定位已取消"));
      locationTimerRef.current = setTimeout(
        () => finish(),
        LOCATION_SAMPLE_TIMEOUT_MS,
      );

      const onSample = (sample: Parameters<typeof toNativeGeoPoint>[0]) => {
        if (sessionId !== locationSessionRef.current) {
          return;
        }

        const candidate = toNativeGeoPoint(sample);
        const nextBest = selectBestLocationSample(best, candidate);
        if (nextBest !== best) {
          best = nextBest;
          setLocation(nextBest);
          setMessage(formatLocationAccuracy(nextBest, "sampling"));
        }

        if (hasReachedTargetAccuracy(nextBest)) {
          finish();
        }
      };
      const onError = (reason: string) => finish(new Error(reason));
      const subscriptionPromise = Platform.OS === "web"
        ? Promise.resolve(watchBrowserPosition(
          navigator.geolocation as BrowserGeolocation,
          onSample,
          onError,
        ))
        : Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest,
            distanceInterval: 0,
          },
          onSample,
          onError,
        );

      void subscriptionPromise.then((subscription) => {
        if (settled || sessionId !== locationSessionRef.current) {
          subscription.remove();
        } else {
          locationSubscriptionRef.current = subscription;
        }
      }).catch((error: unknown) => {
        finish(error instanceof Error ? error : new Error("定位失败"));
      });
    });
  }

  async function locate(selectedMode = mode): Promise<void> {
    const requestId = locateRequestRef.current + 1;
    locateRequestRef.current = requestId;
    setMode(selectedMode);
    setLoading(true);
    if (selectedMode !== "native") {
      stopNativeSampling();
    } else {
      setMessage("正在提高定位精度…");
    }

    try {
      const nextLocation = selectedMode === "native"
        ? await sampleNativeLocation()
        : await demoProvider.advance();

      if (requestId !== locateRequestRef.current) {
        return;
      }
      setLocation(nextLocation);
      setMessage(
        selectedMode === "native"
          ? formatLocationAccuracy(nextLocation, "complete")
          : "模拟定位 · 地图已更新",
      );

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      if (requestId !== locateRequestRef.current) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : "定位失败";
      if (errorMessage !== "定位已取消") {
        setMessage(errorMessage);
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        );
      }
    } finally {
      if (requestId === locateRequestRef.current) {
        setLoading(false);
      }
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>POCKET FRIEND</Text>
          <Text style={styles.subtitle}>{state ? `${message} · ${state.statusText}` : message}</Text>
        </View>

        <View style={styles.controls}>
          {locationModes.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              onPress={() => void locate(item)}
              style={[styles.modeButton, mode === item && styles.modeButtonActive]}
            >
              <Text style={[styles.modeText, mode === item && styles.modeTextActive]}>
                {item === "simulated" ? "SIM" : "GPS"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.settingsPanel}>
          <View style={styles.settingHeader}>
            <View>
              <Text style={styles.settingTitle}>相遇设置</Text>
              <Text style={styles.settingHint}>设置会立即影响附近候选</Text>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: settings.discoverable }}
              onPress={() => {
                setSettings((previous) => ({
                  ...previous,
                  discoverable: !previous.discoverable,
                }));
                setSelectedPlayerId(null);
              }}
              style={[
                styles.discoveryToggle,
                settings.discoverable && styles.discoveryToggleActive,
              ]}
            >
              <Text
                style={[
                  styles.discoveryToggleText,
                  settings.discoverable && styles.discoveryToggleTextActive,
                ]}
              >
                {settings.discoverable ? "可被发现：开" : "可被发现：关"}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.settingLabel}>发现范围</Text>
          <View style={styles.segmentRow}>
            {DISCOVERY_RADIUS_OPTIONS.map((radius) => (
              <Pressable
                key={radius}
                accessibilityRole="button"
                accessibilityState={{ selected: settings.discoveryRadiusMeters === radius }}
                onPress={() => setSettings((previous) => ({
                  ...previous,
                  discoveryRadiusMeters: radius,
                }))}
                style={[
                  styles.segmentButton,
                  settings.discoveryRadiusMeters === radius && styles.segmentButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    settings.discoveryRadiusMeters === radius && styles.segmentTextActive,
                  ]}
                >
                  {radius >= 1_000 ? `${radius / 1_000} km` : `${radius} m`}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.settingLabel}>距离精度</Text>
          <View style={styles.segmentRow}>
            {DISTANCE_PRECISION_OPTIONS.map((precision) => (
              <Pressable
                key={precision}
                accessibilityRole="button"
                accessibilityState={{ selected: settings.distancePrecision === precision }}
                onPress={() => setSettings((previous) => ({
                  ...previous,
                  distancePrecision: precision,
                }))}
                style={[
                  styles.segmentButton,
                  settings.distancePrecision === precision && styles.segmentButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    settings.distancePrecision === precision && styles.segmentTextActive,
                  ]}
                >
                  {precision === "region" ? "区域" : precision}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <DynamicVectorMap
          focusRequest={mapFocusRequest}
          markers={mapMarkers}
          onSelectPlayer={selectPlayer}
          sourceLabel={location?.source === "native" ? "GPS" : "SIM"}
        />

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>附近的人</Text>
            {loading ? <ActivityIndicator color="#1c1c1c" /> : null}
          </View>

          {(state?.nearbyMatches.length ?? 0) === 0 ? (
            <Text style={styles.emptyText}>{message}</Text>
          ) : (
            state?.nearbyMatches.map((match) => (
              <Pressable
                key={match.player.id}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedPlayerId === match.player.id }}
                onPress={() => selectPlayer(match.player.id)}
                style={[
                  styles.matchRow,
                  selectedPlayerId === match.player.id && styles.matchRowSelected,
                ]}
              >
                <View style={[styles.matchAvatar, { backgroundColor: avatarColors[match.player.avatar] }]}>
                  <Text style={styles.avatarText}>{match.player.displayName.slice(0, 1)}</Text>
                </View>
                <View style={styles.matchBody}>
                  <Text style={styles.matchName}>{match.player.displayName}</Text>
                  <Text style={styles.matchReason}>{match.reason}</Text>
                </View>
                <Text style={styles.distance}>{match.displayDistance}</Text>
              </Pressable>
            ))
          )}

          {selectedMatch ? (
            <View style={styles.matchDetail}>
              <Text style={styles.detailTitle}>
                {selectedMatch.player.displayName} · 匹配度 {selectedMatch.score}
              </Text>
              <Text style={styles.detailText}>
                共同兴趣：{selectedMatch.sharedInterests.join("、")}
              </Text>
              <Text style={styles.detailText}>{selectedMatch.reason}</Text>
              <Text style={styles.detailDistance}>{selectedMatch.displayDistance}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#18232f",
  },
  screen: {
    alignItems: "center",
    alignSelf: "center",
    gap: 14,
    maxWidth: 960,
    padding: 18,
    width: "100%",
  },
  header: {
    alignSelf: "stretch",
    borderColor: "#f8f1c2",
    borderWidth: 4,
    backgroundColor: "#26384f",
    padding: 12,
  },
  title: {
    color: "#ffd84d",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
  },
  subtitle: {
    color: "#e7f6ff",
    fontSize: 14,
    marginTop: 6,
  },
  controls: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: 8,
  },
  settingsPanel: {
    alignSelf: "stretch",
    borderColor: "#f8f1c2",
    borderWidth: 4,
    backgroundColor: "#26384f",
    gap: 8,
    padding: 10,
  },
  settingHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  settingTitle: {
    color: "#ffd84d",
    fontSize: 17,
    fontWeight: "900",
  },
  settingHint: {
    color: "#e7f6ff",
    fontSize: 11,
    marginTop: 2,
  },
  discoveryToggle: {
    alignItems: "center",
    backgroundColor: "#4b5868",
    borderColor: "#f8f1c2",
    borderWidth: 3,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 10,
  },
  discoveryToggleActive: {
    backgroundColor: "#50e3a4",
  },
  discoveryToggleText: {
    color: "#f8f1c2",
    fontSize: 12,
    fontWeight: "900",
  },
  discoveryToggleTextActive: {
    color: "#18232f",
  },
  settingLabel: {
    color: "#e7f6ff",
    fontSize: 12,
    fontWeight: "800",
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  segmentButton: {
    alignItems: "center",
    backgroundColor: "#31445c",
    borderColor: "#f8f1c2",
    borderWidth: 2,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 68,
    paddingHorizontal: 8,
  },
  segmentButtonActive: {
    backgroundColor: "#ffd84d",
  },
  segmentText: {
    color: "#f8f1c2",
    fontSize: 12,
    fontWeight: "900",
  },
  segmentTextActive: {
    color: "#18232f",
  },
  modeButton: {
    flex: 1,
    alignItems: "center",
    borderColor: "#f8f1c2",
    borderWidth: 3,
    backgroundColor: "#31445c",
    minHeight: 44,
    paddingVertical: 10,
  },
  modeButtonActive: {
    backgroundColor: "#50e3a4",
  },
  modeText: {
    color: "#f8f1c2",
    fontSize: 13,
    fontWeight: "900",
  },
  modeTextActive: {
    color: "#18232f",
  },
  avatarText: {
    color: "#1c1c1c",
    fontSize: 11,
    fontWeight: "900",
  },
  panel: {
    alignSelf: "stretch",
    borderColor: "#f8f1c2",
    borderWidth: 4,
    backgroundColor: "#fff7d2",
    padding: 10,
  },
  panelHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  panelTitle: {
    color: "#1c1c1c",
    fontSize: 18,
    fontWeight: "900",
  },
  emptyText: {
    color: "#26384f",
    fontSize: 14,
    lineHeight: 20,
  },
  matchRow: {
    alignItems: "center",
    borderColor: "#1c1c1c",
    borderWidth: 3,
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    padding: 8,
    backgroundColor: "#ffffff",
  },
  matchRowSelected: {
    backgroundColor: "#e7f6ff",
    borderColor: "#245f96",
  },
  matchAvatar: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderColor: "#1c1c1c",
    borderWidth: 3,
  },
  matchBody: {
    flex: 1,
  },
  matchName: {
    color: "#1c1c1c",
    fontSize: 14,
    fontWeight: "900",
  },
  matchReason: {
    color: "#425063",
    fontSize: 12,
    lineHeight: 17,
  },
  distance: {
    color: "#26384f",
    fontSize: 12,
    fontWeight: "900",
  },
  matchDetail: {
    backgroundColor: "#26384f",
    borderColor: "#1c1c1c",
    borderWidth: 3,
    gap: 4,
    padding: 10,
  },
  detailTitle: {
    color: "#ffd84d",
    fontSize: 15,
    fontWeight: "900",
  },
  detailText: {
    color: "#e7f6ff",
    fontSize: 12,
    lineHeight: 18,
  },
  detailDistance: {
    color: "#50e3a4",
    fontSize: 13,
    fontWeight: "900",
  },
});
