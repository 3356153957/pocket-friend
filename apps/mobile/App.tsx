import { useMemo, useState } from "react";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import {
  ActivityIndicator,
  Image,
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
import { createNearbyGameState, HUPAN_FIXED_SELF_LOCATION } from "./src/nearbyGame.ts";
import { createSatelliteTiles } from "./src/satelliteTiles.ts";

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
const satelliteTiles = createSatelliteTiles({
  center: HUPAN_FIXED_SELF_LOCATION,
  zoom: 17,
  tileSize: 256,
  gridSize: 3,
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

async function nativeLocation(): Promise<GeoPoint> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("定位权限未开启");
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: location.coords.accuracy ?? 50,
    capturedAt: new Date(location.timestamp).toISOString(),
    coordinateSystem: "wgs84",
    source: "native",
  };
}

export default function App() {
  const [mode, setMode] = useState<LocationMode>("simulated");
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("点击定位，进入湖畔像素地图");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [settings, setSettings] = useState<DemoDiscoverySettings>({
    discoverable: true,
    discoveryRadiusMeters: 800,
    distancePrecision: "100m",
  });
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

  async function locate(selectedMode = mode): Promise<void> {
    setMode(selectedMode);
    setLoading(true);

    try {
      const nextLocation = selectedMode === "native"
        ? await nativeLocation()
        : await demoProvider.advance();

      setLocation(nextLocation);
      setMessage(selectedMode === "native" ? "已读取手机定位 · 你的地图头像固定在湖畔" : "模拟定位 · 你的地图头像固定在湖畔");

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "定位失败");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } finally {
      setLoading(false);
    }
  }

  const mapScale = 0.86;
  const mapWidth = HUPAN_PIXEL_MAP.width * mapScale;
  const mapHeight = HUPAN_PIXEL_MAP.height * mapScale;

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

        <View style={[styles.map, { width: mapWidth, height: mapHeight }]}>
          <View
            style={[
              styles.satelliteLayer,
              {
                left: -(satelliteTiles[0]!.size * 3 - mapWidth) / 2,
                top: -(satelliteTiles[0]!.size * 3 - mapHeight) / 2,
              },
            ]}
          >
            {satelliteTiles.map((tile) => (
              <Image
                key={tile.id}
                source={{ uri: tile.url }}
                style={[
                  styles.satelliteTile,
                  {
                    left: tile.left,
                    top: tile.top,
                    width: tile.size,
                    height: tile.size,
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.satelliteTint} />
          {HUPAN_PIXEL_MAP.landmarks.map((landmark) => {
            const x = (landmark.longitude - HUPAN_PIXEL_MAP.bounds.west)
              / (HUPAN_PIXEL_MAP.bounds.east - HUPAN_PIXEL_MAP.bounds.west) * mapWidth;
            const y = (HUPAN_PIXEL_MAP.bounds.north - landmark.latitude)
              / (HUPAN_PIXEL_MAP.bounds.north - HUPAN_PIXEL_MAP.bounds.south) * mapHeight;

            return (
              <View key={landmark.id} style={[styles.landmark, { left: x - 16, top: y - 12 }]}>
                <Text style={styles.landmarkText}>{landmark.shortName}</Text>
              </View>
            );
          })}
          {state?.visiblePlayers.map((player) => (
            <View
              key={player.id}
              style={[
                styles.avatar,
                {
                  backgroundColor: avatarColors[player.avatar],
                  left: player.pixel.x * mapScale - 12,
                  top: player.pixel.y * mapScale - 12,
                },
                player.isSelf && styles.selfAvatar,
              ]}
            >
              <Text style={styles.avatarText}>{player.isSelf ? "你" : player.displayName.slice(0, 1)}</Text>
            </View>
          ))}
        </View>

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
                onPress={() => setSelectedPlayerId(match.player.id)}
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
    gap: 14,
    padding: 18,
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
  map: {
    overflow: "hidden",
    borderColor: "#f8f1c2",
    borderWidth: 5,
    backgroundColor: "#1d2c28",
  },
  satelliteLayer: {
    position: "absolute",
    width: 768,
    height: 768,
  },
  satelliteTile: {
    position: "absolute",
  },
  satelliteTint: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: "rgba(24, 35, 47, 0.22)",
  },
  road: {
    position: "absolute",
    backgroundColor: "#d7cf9a",
    borderColor: "#8a7b55",
    borderWidth: 2,
  },
  roadNorth: {
    left: 0,
    right: 0,
    top: 58,
    height: 28,
  },
  roadWest: {
    left: 48,
    top: 0,
    bottom: 0,
    width: 28,
  },
  water: {
    position: "absolute",
    right: 18,
    bottom: 42,
    width: 90,
    height: 120,
    backgroundColor: "#4fb4ff",
    borderColor: "#245f96",
    borderWidth: 4,
  },
  landmark: {
    position: "absolute",
    maxWidth: 72,
    borderColor: "#1c1c1c",
    borderWidth: 2,
    backgroundColor: "#ffd84d",
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  landmarkText: {
    color: "#1c1c1c",
    fontSize: 10,
    fontWeight: "900",
  },
  avatar: {
    position: "absolute",
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderColor: "#1c1c1c",
    borderWidth: 3,
  },
  selfAvatar: {
    borderColor: "#ffffff",
    borderWidth: 4,
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
