import { StyleSheet, Text, View } from "react-native";

import type {
  DynamicMapMarker,
  MapFocusRequest,
} from "./mapModel.ts";

export interface DynamicVectorMapProps {
  markers: DynamicMapMarker[];
  focusRequest: MapFocusRequest;
  sourceLabel: string;
  onSelectPlayer: (playerId: string) => void;
}

export default function DynamicVectorMap(_props: DynamicVectorMapProps) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.title}>动态地图暂仅支持网页端</Text>
      <Text style={styles.detail}>附近的人列表仍可正常使用。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    backgroundColor: "#111922",
    borderColor: "#33404d",
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    justifyContent: "center",
    minHeight: 360,
    padding: 24,
  },
  title: {
    color: "#f3f7fb",
    fontSize: 16,
    fontWeight: "800",
  },
  detail: {
    color: "#aab7c4",
    fontSize: 13,
  },
});
