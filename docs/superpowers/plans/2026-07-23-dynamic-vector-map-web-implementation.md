# 动态矢量地图 Web 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 Expo Web Demo 的静态卫星瓦片替换为可平移、缩放、旋转、倾斜并与人物选择联动的高德动态矢量地图。

**架构：** 高德地图实例和覆盖物封装在 Web 专用 React 组件中，页面只传入纯地图标记模型和聚焦指令。配置校验、坐标过滤、标记差异和聚焦目标均放在纯 TypeScript 模块中测试；距离、匹配、隐私和位置标准化继续由 `nearby-core` 与 `nearbyGame` 负责。

**技术栈：** Expo 57、React Native Web、TypeScript、Node Test Runner、高德 JavaScript API 2.0、`@amap/amap-jsapi-loader@1.0.1`、`@amap/amap-jsapi-types@0.0.15`

---

## 文件结构

### 新建

- `apps/mobile/src/map/mapConfig.ts`：读取并校验公开的高德 Web 配置。
- `apps/mobile/src/map/mapModel.ts`：生成地图标记、过滤无效坐标、生成聚焦目标和标记差异。
- `apps/mobile/src/map/DynamicVectorMap.web.tsx`：创建高德实例、同步覆盖物和实现 Web 地图控制。
- `apps/mobile/src/map/DynamicVectorMap.tsx`：非 Web 构建的明确降级组件。
- `apps/mobile/src/map/amap-globals.d.ts`：加载高德官方类型并声明安全配置。
- `apps/mobile/test/mapConfig.test.ts`：配置完整、缺失和空白值测试。
- `apps/mobile/test/mapModel.test.ts`：标记、无效坐标、选中态、聚焦和差异测试。

### 修改

- `.env.example`：增加公开高德变量和域名限制说明。
- `apps/mobile/package.json`：增加高德 Loader 和类型依赖。
- `package-lock.json`：锁定新增依赖。
- `apps/mobile/tsconfig.json`：使用 Expo Web 兼容的 Bundler 模块解析，以支持 `.web.tsx`。
- `apps/mobile/src/nearbyGame.ts`：恢复真实 GPS/SIM 自身坐标，不再强制固定湖畔。
- `apps/mobile/test/nearbyGame.test.ts`：将固定坐标断言改为真实坐标标准化断言。
- `apps/mobile/App.tsx`：用动态地图组件替换静态地图，并连接人物选择和聚焦。

### 删除

- `apps/mobile/src/satelliteTiles.ts`：删除静态卫星瓦片拼接。
- `apps/mobile/test/satelliteTiles.test.ts`：删除对应旧行为测试。

---

### 任务 1：高德配置与依赖

**文件：**

- 创建：`apps/mobile/src/map/mapConfig.ts`
- 创建：`apps/mobile/test/mapConfig.test.ts`
- 修改：`.env.example`
- 修改：`apps/mobile/package.json`
- 修改：`package-lock.json`

- [ ] **步骤 1：编写失败的配置测试**

创建 `apps/mobile/test/mapConfig.test.ts`：

```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { readAmapConfig } from "../src/map/mapConfig.ts";

describe("readAmapConfig", () => {
  test("returns a ready config when both public values are present", () => {
    assert.deepEqual(readAmapConfig({
      EXPO_PUBLIC_AMAP_KEY: "web-key",
      EXPO_PUBLIC_AMAP_SECURITY_JS_CODE: "security-code",
    }), {
      status: "ready",
      key: "web-key",
      securityJsCode: "security-code",
    });
  });

  test("reports every missing or blank public value", () => {
    assert.deepEqual(readAmapConfig({
      EXPO_PUBLIC_AMAP_KEY: " ",
    }), {
      status: "missing",
      missing: [
        "EXPO_PUBLIC_AMAP_KEY",
        "EXPO_PUBLIC_AMAP_SECURITY_JS_CODE",
      ],
    });
  });
});
```

- [ ] **步骤 2：运行测试验证红灯**

运行：

```text
node --experimental-strip-types --test apps/mobile/test/mapConfig.test.ts
```

预期：FAIL，`ERR_MODULE_NOT_FOUND` 指向 `src/map/mapConfig.ts`。

- [ ] **步骤 3：实现最小配置读取**

创建 `apps/mobile/src/map/mapConfig.ts`：

```ts
export const AMAP_PUBLIC_ENV_NAMES = [
  "EXPO_PUBLIC_AMAP_KEY",
  "EXPO_PUBLIC_AMAP_SECURITY_JS_CODE",
] as const;

type AmapEnvName = typeof AMAP_PUBLIC_ENV_NAMES[number];
type PublicEnvironment = Partial<Record<AmapEnvName, string>>;

export type AmapConfig =
  | {
      status: "ready";
      key: string;
      securityJsCode: string;
    }
  | {
      status: "missing";
      missing: AmapEnvName[];
    };

export function readAmapConfig(environment: PublicEnvironment): AmapConfig {
  const missing = AMAP_PUBLIC_ENV_NAMES.filter(
    (name) => !environment[name]?.trim(),
  );

  if (missing.length > 0) {
    return { status: "missing", missing };
  }

  return {
    status: "ready",
    key: environment.EXPO_PUBLIC_AMAP_KEY!.trim(),
    securityJsCode: environment.EXPO_PUBLIC_AMAP_SECURITY_JS_CODE!.trim(),
  };
}
```

- [ ] **步骤 4：安装并锁定官方 Loader 与类型**

运行：

```text
npm install @amap/amap-jsapi-loader@1.0.1 --workspace @pf/mobile
npm install --save-dev @amap/amap-jsapi-types@0.0.15 --workspace @pf/mobile
```

在 `.env.example` 的 Mobile public configuration 中增加：

```dotenv
# Public browser values. Restrict allowed domains in the AMap console.
EXPO_PUBLIC_AMAP_KEY=
EXPO_PUBLIC_AMAP_SECURITY_JS_CODE=
```

- [ ] **步骤 5：验证配置测试与依赖树**

运行：

```text
node --experimental-strip-types --test apps/mobile/test/mapConfig.test.ts
npm ls @amap/amap-jsapi-loader @amap/amap-jsapi-types --workspace @pf/mobile
```

预期：2 项配置测试 PASS；依赖树显示 Loader `1.0.1` 和类型 `0.0.15`。

- [ ] **步骤 6：提交并推送配置批次**

```text
git add .env.example apps/mobile/package.json package-lock.json apps/mobile/src/map/mapConfig.ts apps/mobile/test/mapConfig.test.ts
git commit -m "feat: add amap web configuration"
git push origin codex/dynamic-vector-map
```

---

### 任务 2：地图标记与聚焦模型

**文件：**

- 创建：`apps/mobile/src/map/mapModel.ts`
- 创建：`apps/mobile/test/mapModel.test.ts`

- [ ] **步骤 1：编写失败的标记模型测试**

创建 `apps/mobile/test/mapModel.test.ts`：

```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { VisiblePlayer } from "../src/nearbyGame.ts";
import {
  buildMapMarkers,
  createMapFocusTarget,
  diffMapMarkers,
} from "../src/map/mapModel.ts";

const player = (
  id: string,
  longitude: number,
  latitude: number,
  isSelf = false,
): VisiblePlayer => ({
  id,
  displayName: id === "me" ? "你" : "Ada",
  avatar: isSelf ? "mint" : "coral",
  pixel: { x: 0, y: 0, isOutOfBounds: false },
  location: {
    longitude,
    latitude,
    accuracyMeters: 18,
    capturedAt: "2026-07-23T10:00:00.000+08:00",
    coordinateSystem: "gcj02",
    source: "simulated",
  },
  sourceLabel: "SIM",
  isSelf,
});

describe("dynamic map model", () => {
  test("builds accessible markers and filters invalid coordinates", () => {
    const markers = buildMapMarkers([
      player("me", 120.007986, 30.293312, true),
      player("ada", 120.00487, 30.292227),
      player("broken", Number.NaN, 30.2),
    ], "ada");

    assert.deepEqual(markers.map((marker) => ({
      id: marker.id,
      position: marker.position,
      selected: marker.selected,
      accessibilityLabel: marker.accessibilityLabel,
    })), [
      {
        id: "me",
        position: [120.007986, 30.293312],
        selected: false,
        accessibilityLabel: "你，当前位置",
      },
      {
        id: "ada",
        position: [120.00487, 30.292227],
        selected: true,
        accessibilityLabel: "Ada，附近的人，已选中",
      },
    ]);
  });

  test("creates focus targets for Hupan, self, and a selected player", () => {
    const markers = buildMapMarkers([
      player("me", 120.007986, 30.293312, true),
      player("ada", 120.00487, 30.292227),
    ], null);

    assert.deepEqual(createMapFocusTarget({ kind: "hupan" }, markers), {
      center: [120.007986, 30.293312],
      zoom: 16,
    });
    assert.deepEqual(createMapFocusTarget({ kind: "self" }, markers), {
      center: [120.007986, 30.293312],
      zoom: 17,
    });
    assert.deepEqual(
      createMapFocusTarget({ kind: "player", playerId: "ada" }, markers),
      { center: [120.00487, 30.292227] },
    );
  });

  test("diffs marker additions, updates, and removals by id", () => {
    const before = buildMapMarkers([
      player("me", 120.007986, 30.293312, true),
      player("ada", 120.00487, 30.292227),
    ], null);
    const after = buildMapMarkers([
      player("me", 120.008, 30.2934, true),
      player("lin", 120.005427, 30.293364),
    ], "lin");

    const diff = diffMapMarkers(before, after);

    assert.deepEqual(diff.removeIds, ["ada"]);
    assert.deepEqual(diff.add.map((marker) => marker.id), ["lin"]);
    assert.deepEqual(diff.update.map((marker) => marker.id), ["me"]);
  });
});
```

- [ ] **步骤 2：运行测试验证红灯**

运行：

```text
node --experimental-strip-types --test apps/mobile/test/mapModel.test.ts
```

预期：FAIL，`ERR_MODULE_NOT_FOUND` 指向 `src/map/mapModel.ts`。

- [ ] **步骤 3：实现标记、聚焦和差异模型**

创建 `apps/mobile/src/map/mapModel.ts`：

```ts
import type { PixelAvatar } from "../../../../packages/nearby-core/src/index.ts";
import type { VisiblePlayer } from "../nearbyGame.ts";

export type MapPosition = [longitude: number, latitude: number];

export interface DynamicMapMarker {
  id: string;
  displayName: string;
  avatar: PixelAvatar;
  position: MapPosition;
  isSelf: boolean;
  selected: boolean;
  accessibilityLabel: string;
}

export type MapFocusRequest =
  | { kind: "hupan"; nonce?: number }
  | { kind: "self"; nonce?: number }
  | { kind: "player"; playerId: string; nonce?: number };

export interface MapFocusTarget {
  center: MapPosition;
  zoom?: number;
}

export interface MapMarkerDiff {
  add: DynamicMapMarker[];
  update: DynamicMapMarker[];
  removeIds: string[];
}

export const HUPAN_MAP_CENTER: MapPosition = [120.007986, 30.293312];

function isValidPosition(longitude: number, latitude: number): boolean {
  return Number.isFinite(longitude)
    && Number.isFinite(latitude)
    && longitude >= -180
    && longitude <= 180
    && latitude >= -90
    && latitude <= 90;
}

export function buildMapMarkers(
  players: VisiblePlayer[],
  selectedPlayerId: string | null,
): DynamicMapMarker[] {
  return players.flatMap((player) => {
    const { longitude, latitude } = player.location;
    if (!isValidPosition(longitude, latitude)) {
      return [];
    }

    const selected = player.id === selectedPlayerId;
    const role = player.isSelf ? "当前位置" : "附近的人";
    return [{
      id: player.id,
      displayName: player.displayName,
      avatar: player.avatar,
      position: [longitude, latitude] as MapPosition,
      isSelf: player.isSelf,
      selected,
      accessibilityLabel: `${player.displayName}，${role}${selected ? "，已选中" : ""}`,
    }];
  });
}

export function createMapFocusTarget(
  request: MapFocusRequest,
  markers: DynamicMapMarker[],
): MapFocusTarget | null {
  if (request.kind === "hupan") {
    return { center: HUPAN_MAP_CENTER, zoom: 16 };
  }

  const marker = request.kind === "self"
    ? markers.find((candidate) => candidate.isSelf)
    : markers.find((candidate) => candidate.id === request.playerId);

  if (!marker) {
    return null;
  }

  return {
    center: marker.position,
    ...(request.kind === "self" ? { zoom: 17 } : {}),
  };
}

export function diffMapMarkers(
  previous: DynamicMapMarker[],
  next: DynamicMapMarker[],
): MapMarkerDiff {
  const previousById = new Map(previous.map((marker) => [marker.id, marker]));
  const nextById = new Map(next.map((marker) => [marker.id, marker]));

  return {
    add: next.filter((marker) => !previousById.has(marker.id)),
    update: next.filter((marker) => {
      const before = previousById.get(marker.id);
      return before !== undefined && JSON.stringify(before) !== JSON.stringify(marker);
    }),
    removeIds: previous
      .filter((marker) => !nextById.has(marker.id))
      .map((marker) => marker.id),
  };
}
```

- [ ] **步骤 4：运行地图模型测试**

运行：

```text
node --experimental-strip-types --test apps/mobile/test/mapModel.test.ts
```

预期：3 项测试 PASS。

- [ ] **步骤 5：提交并推送地图模型**

```text
git add apps/mobile/src/map/mapModel.ts apps/mobile/test/mapModel.test.ts
git commit -m "feat: add dynamic map marker model"
git push origin codex/dynamic-vector-map
```

---

### 任务 3：恢复真实自身坐标

**文件：**

- 修改：`apps/mobile/test/nearbyGame.test.ts`
- 修改：`apps/mobile/src/nearbyGame.ts`

- [ ] **步骤 1：将固定湖畔测试改成真实坐标测试**

在 `apps/mobile/test/nearbyGame.test.ts` 中移除 `HUPAN_FIXED_SELF_LOCATION` 导入，将第一项测试替换为：

```ts
test("keeps the normalized reported location for the self player", () => {
  const state = createNearbyGameState({
    now,
    currentPlayer: {
      id: "me",
      displayName: "我",
      avatar: "mint",
      interests: ["8bit", "coffee"],
      discoverable: true,
      discoveryRadiusMeters: 800,
      distancePrecision: "100m",
    },
    currentLocation: {
      latitude: 30.2708,
      longitude: 120.0185,
      accuracyMeters: 18,
      capturedAt: "2026-07-23T09:59:30.000+08:00",
      coordinateSystem: "gcj02",
      source: "native",
    },
    presences: [],
  });

  const self = state.visiblePlayers.find((player) => player.isSelf);

  assert.equal(self?.location.latitude, 30.2708);
  assert.equal(self?.location.longitude, 120.0185);
  assert.equal(self?.location.source, "native");
});
```

- [ ] **步骤 2：运行测试验证红灯**

运行：

```text
node --experimental-strip-types --test apps/mobile/test/nearbyGame.test.ts
```

预期：FAIL；实际坐标仍为 `30.293312,120.007986`。

- [ ] **步骤 3：移除固定坐标覆盖**

在 `apps/mobile/src/nearbyGame.ts` 中删除 `HUPAN_FIXED_SELF_LOCATION`，将 `createNearbyGameState` 开头改为：

```ts
export function createNearbyGameState(input: CreateNearbyGameStateInput): NearbyGameState {
  const now = input.now ?? new Date();
  const normalizedSelfLocation = toGcj02(input.currentLocation);
  const normalizedPresences = input.presences.map(normalizeSnapshot);
```

- [ ] **步骤 4：验证真实坐标与既有附近逻辑**

运行：

```text
node --experimental-strip-types --test apps/mobile/test/nearbyGame.test.ts packages/nearby-core/test/*.test.ts
```

预期：全部 PASS。

- [ ] **步骤 5：提交并推送真实定位修复**

```text
git add apps/mobile/src/nearbyGame.ts apps/mobile/test/nearbyGame.test.ts
git commit -m "fix: keep reported self location on the map"
git push origin codex/dynamic-vector-map
```

---

### 任务 4：高德 Web 地图组件

**文件：**

- 创建：`apps/mobile/src/map/amap-globals.d.ts`
- 创建：`apps/mobile/src/map/DynamicVectorMap.web.tsx`
- 创建：`apps/mobile/src/map/DynamicVectorMap.tsx`
- 修改：`apps/mobile/tsconfig.json`

- [ ] **步骤 1：调整 Expo Web 模块解析并声明高德全局类型**

将 `apps/mobile/tsconfig.json` 中的模块配置改为：

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "allowImportingTsExtensions": true,
    "composite": true,
    "exactOptionalPropertyTypes": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "noUncheckedIndexedAccess": true,
    "strict": true,
    "verbatimModuleSyntax": true
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts",
    "../../packages/nearby-core/src/**/*.ts"
  ]
}
```

创建 `apps/mobile/src/map/amap-globals.d.ts`：

```ts
/// <reference types="@amap/amap-jsapi-types" />

interface Window {
  _AMapSecurityConfig?: {
    securityJsCode: string;
  };
}
```

- [ ] **步骤 2：创建非 Web 降级组件**

创建 `apps/mobile/src/map/DynamicVectorMap.tsx`：

```tsx
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
      <Text style={styles.title}>动态地图当前在 Web Demo 中可用</Text>
      <Text style={styles.body}>原生手机地图将在独立阶段接入。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    backgroundColor: "#26384f",
    borderColor: "#f8f1c2",
    borderWidth: 4,
    justifyContent: "center",
    minHeight: 420,
    padding: 16,
  },
  title: {
    color: "#ffd84d",
    fontSize: 16,
    fontWeight: "900",
  },
  body: {
    color: "#e7f6ff",
    fontSize: 13,
    marginTop: 6,
  },
});
```

- [ ] **步骤 3：实现 Web 地图生命周期和控件**

创建 `apps/mobile/src/map/DynamicVectorMap.web.tsx`，实现以下确定接口：

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { readAmapConfig } from "./mapConfig.ts";
import {
  createMapFocusTarget,
  diffMapMarkers,
  HUPAN_MAP_CENTER,
  type DynamicMapMarker,
  type MapFocusRequest,
} from "./mapModel.ts";

export interface DynamicVectorMapProps {
  markers: DynamicMapMarker[];
  focusRequest: MapFocusRequest;
  sourceLabel: string;
  onSelectPlayer: (playerId: string) => void;
}

const avatarColors = {
  mint: "#50e3a4",
  coral: "#ff6f61",
  sun: "#ffd84d",
  sky: "#4fb4ff",
  violet: "#9b78ff",
} as const;

export default function DynamicVectorMap(props: DynamicVectorMapProps) {
  const { width } = useWindowDimensions();
  const containerIdRef = useRef(`pf-amap-${Math.random().toString(36).slice(2)}`);
  const mapRef = useRef<AMap.Map | null>(null);
  const overlaysRef = useRef(new Map<string, AMap.Marker>());
  const previousMarkersRef = useRef<DynamicMapMarker[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  const [zoom, setZoom] = useState(16);
  const config = useMemo(() => readAmapConfig({
    EXPO_PUBLIC_AMAP_KEY: process.env.EXPO_PUBLIC_AMAP_KEY,
    EXPO_PUBLIC_AMAP_SECURITY_JS_CODE:
      process.env.EXPO_PUBLIC_AMAP_SECURITY_JS_CODE,
  }), []);

  useEffect(() => {
    if (config.status === "missing") {
      setStatus("error");
      setErrorMessage(`缺少配置：${config.missing.join("、")}`);
      return;
    }

    let disposed = false;
    window._AMapSecurityConfig = {
      securityJsCode: config.securityJsCode,
    };

    setStatus("loading");
    void AMapLoader.load({
      key: config.key,
      version: "2.0",
      plugins: [],
    }).then(() => {
      if (disposed) {
        return;
      }

      const map = new AMap.Map(containerIdRef.current, {
        center: HUPAN_MAP_CENTER,
        zoom: 16,
        viewMode: "3D",
        pitch: 0,
        rotation: 0,
        pitchEnable: true,
        rotateEnable: true,
        resizeEnable: true,
      });
      map.on("zoomchange", () => setZoom(Math.round(map.getZoom())));
      mapRef.current = map;
      setStatus("ready");
    }).catch(() => {
      setStatus("error");
      setErrorMessage(
        navigator.onLine
          ? "地图加载失败，请检查高德域名白名单与安全配置"
          : "网络已断开，地图暂时不可用",
      );
    });

    return () => {
      disposed = true;
      overlaysRef.current.clear();
      previousMarkersRef.current = [];
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [config, retryNonce]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") {
      return;
    }

    const diff = diffMapMarkers(previousMarkersRef.current, props.markers);
    for (const id of diff.removeIds) {
      const overlay = overlaysRef.current.get(id);
      if (overlay) {
        map.remove(overlay);
        overlaysRef.current.delete(id);
      }
    }

    for (const marker of [...diff.add, ...diff.update]) {
      const existing = overlaysRef.current.get(marker.id);
      if (existing) {
        map.remove(existing);
      }

      const content = document.createElement("button");
      content.type = "button";
      content.textContent = marker.isSelf ? "你" : marker.displayName.slice(0, 1);
      content.setAttribute("aria-label", marker.accessibilityLabel);
      content.style.cssText = [
        "width:32px",
        "height:32px",
        "border-style:solid",
        `border-width:${marker.selected ? 4 : 3}px`,
        `border-color:${marker.selected ? "#ffffff" : "#1c1c1c"}`,
        `background:${avatarColors[marker.avatar]}`,
        "font-weight:900",
        "cursor:pointer",
        "box-shadow:3px 3px 0 #18232f",
      ].join(";");

      const overlay = new AMap.Marker({
        position: marker.position,
        anchor: "center",
        content,
        zIndex: marker.selected ? 200 : marker.isSelf ? 150 : 100,
      });
      overlay.on("click", () => props.onSelectPlayer(marker.id));
      map.add(overlay);
      overlaysRef.current.set(marker.id, overlay);
    }

    previousMarkersRef.current = props.markers;
  }, [props.markers, props.onSelectPlayer, status]);

  useEffect(() => {
    const map = mapRef.current;
    const target = createMapFocusTarget(props.focusRequest, props.markers);
    if (!map || !target) {
      return;
    }

    if (target.zoom) {
      map.setZoomAndCenter(target.zoom, target.center, false, 350);
    } else {
      map.setCenter(target.center, false, 350);
    }
  }, [props.focusRequest, props.markers]);

  const run = (operation: (map: AMap.Map) => void) => {
    if (mapRef.current) {
      operation(mapRef.current);
    }
  };

  return (
    <View style={[styles.frame, { height: width <= 480 ? 420 : 560 }]}>
      <View nativeID={containerIdRef.current} style={styles.map} />
      <View style={styles.controls}>
        <Pressable accessibilityRole="button" style={styles.button}
          onPress={() => run((map) => map.setZoom(map.getZoom() + 1))}>
          <Text style={styles.buttonText}>＋</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.button}
          onPress={() => run((map) => map.setZoom(map.getZoom() - 1))}>
          <Text style={styles.buttonText}>－</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.button}
          onPress={() => run((map) => map.setZoomAndCenter(16, HUPAN_MAP_CENTER))}>
          <Text style={styles.buttonText}>湖畔</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.button}
          onPress={() => {
            const target = createMapFocusTarget({ kind: "self" }, props.markers);
            if (target) run((map) => map.setZoomAndCenter(target.zoom ?? 17, target.center));
          }}>
          <Text style={styles.buttonText}>我的位置</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.button}
          onPress={() => run((map) => {
            map.setRotation(0);
            map.setPitch(0);
          })}>
          <Text style={styles.buttonText}>朝北</Text>
        </Pressable>
      </View>
      <View style={styles.status}>
        <Text style={styles.statusText}>{props.sourceLabel} · Z{zoom}</Text>
      </View>
      {status !== "ready" ? (
        <View style={styles.message}>
          <Text style={styles.messageTitle}>
            {status === "loading" ? "正在加载矢量地图" : "地图暂时不可用"}
          </Text>
          {errorMessage ? <Text style={styles.messageBody}>{errorMessage}</Text> : null}
          {status === "error" && config.status === "ready" ? (
            <Pressable accessibilityRole="button" style={styles.retry}
              onPress={() => setRetryNonce((value) => value + 1)}>
              <Text style={styles.retryText}>重试</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: "stretch",
    borderColor: "#f8f1c2",
    borderWidth: 4,
    minHeight: 420,
    overflow: "hidden",
    position: "relative",
  },
  map: { flex: 1 },
  controls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    left: 8,
    position: "absolute",
    top: 8,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#26384f",
    borderColor: "#f8f1c2",
    borderWidth: 2,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
  },
  buttonText: { color: "#f8f1c2", fontSize: 12, fontWeight: "900" },
  status: {
    backgroundColor: "#26384f",
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    position: "absolute",
    right: 8,
  },
  statusText: { color: "#50e3a4", fontSize: 11, fontWeight: "900" },
  message: {
    alignItems: "center",
    backgroundColor: "#26384f",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    padding: 20,
    position: "absolute",
    right: 0,
    top: 0,
  },
  messageTitle: { color: "#ffd84d", fontSize: 16, fontWeight: "900" },
  messageBody: { color: "#e7f6ff", fontSize: 12, marginTop: 8 },
  retry: {
    backgroundColor: "#50e3a4",
    borderColor: "#f8f1c2",
    borderWidth: 2,
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  retryText: { color: "#18232f", fontSize: 12, fontWeight: "900" },
});
```

实现时若官方类型对个别重载的参数定义更严格，保持上述行为不变，并使用官方签名调整调用参数；不得用全局 `any` 绕过类型检查。

- [ ] **步骤 4：验证两个平台文件与类型解析**

运行：

```text
npm run typecheck
npm run build:web
```

预期：TypeScript 退出码 0；Expo Web 成功输出 `dist/web`。

- [ ] **步骤 5：提交并推送地图组件**

```text
git add apps/mobile/tsconfig.json apps/mobile/src/map/amap-globals.d.ts apps/mobile/src/map/DynamicVectorMap.tsx apps/mobile/src/map/DynamicVectorMap.web.tsx
git commit -m "feat: add amap vector map component"
git push origin codex/dynamic-vector-map
```

---

### 任务 5：页面联动并移除静态瓦片

**文件：**

- 修改：`apps/mobile/App.tsx`
- 删除：`apps/mobile/src/satelliteTiles.ts`
- 删除：`apps/mobile/test/satelliteTiles.test.ts`

- [ ] **步骤 1：先运行旧卫星测试证明旧行为仍存在**

运行：

```text
node --experimental-strip-types --test apps/mobile/test/satelliteTiles.test.ts
```

预期：PASS，证明接下来删除的是当前有效但已被替代的行为。

- [ ] **步骤 2：在 App 中建立地图模型和聚焦状态**

在 `apps/mobile/App.tsx`：

1. 删除 `Image`、`HUPAN_FIXED_SELF_LOCATION` 和 `createSatelliteTiles` 导入。
2. 删除模块级 `satelliteTiles`。
3. 增加导入：

```tsx
import DynamicVectorMap from "./src/map/DynamicVectorMap";
import {
  buildMapMarkers,
  type MapFocusRequest,
} from "./src/map/mapModel.ts";
```

4. 在 `App` 状态中增加：

```tsx
const [mapFocusRequest, setMapFocusRequest] = useState<MapFocusRequest>({
  kind: "hupan",
  nonce: 0,
});
```

5. 在 `selectedMatch` 后增加：

```tsx
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
```

- [ ] **步骤 3：用动态地图替换静态地图 JSX**

删除 `mapScale`、`mapWidth`、`mapHeight` 以及整个静态 `<View style={styles.map}>` 区块，改为：

```tsx
<DynamicVectorMap
  focusRequest={mapFocusRequest}
  markers={mapMarkers}
  onSelectPlayer={selectPlayer}
  sourceLabel={location?.source === "native" ? "GPS" : "SIM"}
/>
```

将附近列表人物的 `onPress` 从：

```tsx
onPress={() => setSelectedPlayerId(match.player.id)}
```

改为：

```tsx
onPress={() => selectPlayer(match.player.id)}
```

删除不再使用的 `map`、`satelliteLayer`、`satelliteTile`、`satelliteTint`、`road`、`roadNorth`、`roadWest`、`water`、`landmark`、`landmarkText`、`avatar`、`selfAvatar` 样式。

- [ ] **步骤 4：删除静态卫星瓦片生产代码和测试**

```text
git rm apps/mobile/src/satelliteTiles.ts apps/mobile/test/satelliteTiles.test.ts
```

- [ ] **步骤 5：验证全量测试、类型和构建**

运行：

```text
npm test
npm run typecheck
npm run build:web
```

预期：

- 旧卫星瓦片测试不再出现。
- 其余测试全部 PASS。
- TypeScript 退出码 0。
- Expo Web 成功生成 `dist/web`。

- [ ] **步骤 6：提交并推送页面联动**

```text
git add apps/mobile/App.tsx apps/mobile/src/satelliteTiles.ts apps/mobile/test/satelliteTiles.test.ts
git commit -m "feat: replace static tiles with dynamic vector map"
git push origin codex/dynamic-vector-map
```

---

### 任务 6：真实浏览器验收与交付

**文件：**

- 按发现的问题修改：`apps/mobile/src/map/DynamicVectorMap.web.tsx`
- 按发现的问题修改：`apps/mobile/App.tsx`
- 按行为回归增加：`apps/mobile/test/mapModel.test.ts`

- [ ] **步骤 1：准备本地公开配置**

在未跟踪的 `.env.local` 中创建两个赋值：变量名必须分别为
`EXPO_PUBLIC_AMAP_KEY` 和 `EXPO_PUBLIC_AMAP_SECURITY_JS_CODE`，等号右侧必须直接复制高德控制台为开发域名签发的真实值。不得在计划、终端输出或 Git diff 中写入这些值。

确认 `.env.local` 被 `.gitignore` 忽略：

```text
git check-ignore .env.local
```

预期输出：`.env.local`。

- [ ] **步骤 2：启动 Web Demo**

运行：

```text
npm run dev:mobile -- --web
```

保持开发服务器运行，并记录终端显示的本地 URL。

- [ ] **步骤 3：验证 375×812 手机 Web 视口**

使用真实浏览器逐项验证：

1. 页面没有横向滚动。
2. 地图高度约 420 px。
3. 拖动地图后中心点变化。
4. 滚轮或触摸板缩放后 `Z` 数字变化。
5. `＋`、`－`、`湖畔`、`我的位置`、`朝北` 均可点击。
6. 点击 SIM 后人物标记出现并移动。
7. 点击人物标记后下方详情出现。
8. 点击列表人物后地图平滑移动到该人物。
9. 控制台无未处理错误。

- [ ] **步骤 4：验证桌面 Web 视口**

在 1440×900 视口重复以下检查：

1. 地图高度约 560 px。
2. 地图和设置面板不互相遮挡。
3. 鼠标拖动、滚轮缩放、旋转和倾斜可用。
4. 选中态除颜色外还有明显边框。
5. SIM 更新不会把用户手动浏览的地图拉回湖畔。

- [ ] **步骤 5：验证缺少 Key 的降级状态**

停止开发服务器，临时移走 `.env.local` 后重新启动。

预期：

- 地图区域显示缺少 `EXPO_PUBLIC_AMAP_KEY` 和 `EXPO_PUBLIC_AMAP_SECURITY_JS_CODE`。
- 页面没有白屏。
- SIM、设置和附近列表仍能操作。
- 控制台没有未处理异常。

恢复 `.env.local`，不得提交该文件。

- [ ] **步骤 6：若验收发现行为缺陷，先补红灯测试再修复**

对纯逻辑缺陷，在 `apps/mobile/test/mapModel.test.ts` 增加能复现问题的最小测试：

```text
node --experimental-strip-types --test apps/mobile/test/mapModel.test.ts
```

先确认新增测试因观察到的问题 FAIL，再修改生产代码并确认 PASS。视觉尺寸问题修改后必须重新执行对应视口检查。

- [ ] **步骤 7：执行最终验证**

运行：

```text
npm test
npm run typecheck
npm run build:web
git diff --check
git status --short --branch
```

预期：所有命令退出码 0；工作树只有计划内待提交文件或完全干净。

- [ ] **步骤 8：检查代码影响**

使用 `codebase_memory` 重新索引 `D:\Users\17\Documents\friend\.worktrees\dynamic-vector-map`，执行从 `origin/master` 开始的 `detect_changes`。

重点确认：

- `App` 只依赖地图组件公开 Props。
- 地图模块不反向依赖匹配或 Gateway。
- 删除 `satelliteTiles` 后没有剩余调用者。

- [ ] **步骤 9：提交、推送并进入分支收尾**

如果验收产生修复：

```text
git add apps/mobile/App.tsx apps/mobile/src/map/DynamicVectorMap.web.tsx apps/mobile/test/mapModel.test.ts
git commit -m "fix: polish dynamic vector map interactions"
git push origin codex/dynamic-vector-map
```

运行 `finishing-a-development-branch`，基于最新测试结果决定合并、PR 或保留分支。
