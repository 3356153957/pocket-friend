import { useMemo, useState } from "react";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import {
  ActivityIndicator,
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
import { createNearbyGameState } from "./src/nearbyGame.ts";

type LocationMode = "simulated" | "native" | "jacoo";

const currentPlayer: PlayerProfile = {
  id: "me",
  displayName: "你",
  avatar: "mint",
  interests: ["8bit", "coffee", "hardware"],
  discoverable: true,
  discoveryRadiusMeters: 800,
  distancePrecision: "100m",
};

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
  }, [location]);

  async function locate(selectedMode = mode): Promise<void> {
    setMode(selectedMode);
    setLoading(true);

    try {
      const nextLocation = selectedMode === "native"
        ? await nativeLocation()
        : selectedMode === "jacoo"
          ? {
              latitude: 30.289153,
              longitude: 120.008285,
              accuracyMeters: 68,
              capturedAt: new Date().toISOString(),
              coordinateSystem: "wgs84",
              source: "jacoo",
            } satisfies GeoPoint
          : await demoProvider.advance();

      setLocation(nextLocation);
      setMessage(selectedMode === "native" ? "已读取手机定位" : selectedMode === "jacoo" ? "已载入 JACOO iPhone 位置样本" : "模拟玩家移动了一格");

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
          <Text style={styles.subtitle}>{state?.statusText ?? message}</Text>
        </View>

        <View style={styles.controls}>
          {(["simulated", "native", "jacoo"] as LocationMode[]).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              onPress={() => void locate(item)}
              style={[styles.modeButton, mode === item && styles.modeButtonActive]}
            >
              <Text style={[styles.modeText, mode === item && styles.modeTextActive]}>
                {item === "simulated" ? "SIM" : item === "native" ? "GPS" : "JACOO"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.map, { width: mapWidth, height: mapHeight }]}>
          <View style={[styles.road, styles.roadNorth]} />
          <View style={[styles.road, styles.roadWest]} />
          <View style={[styles.water]} />
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
              <View key={match.player.id} style={styles.matchRow}>
                <View style={[styles.matchAvatar, { backgroundColor: avatarColors[match.player.avatar] }]}>
                  <Text style={styles.avatarText}>{match.player.displayName.slice(0, 1)}</Text>
                </View>
                <View style={styles.matchBody}>
                  <Text style={styles.matchName}>{match.player.displayName}</Text>
                  <Text style={styles.matchReason}>{match.reason}</Text>
                </View>
                <Text style={styles.distance}>{match.displayDistance}</Text>
              </View>
            ))
          )}
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
    backgroundColor: "#67c474",
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
});
