# 浏览器定位与卫星地图实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 网页端自动连续采样浏览器位置并展示真实精度，同时默认显示可切换到标准底图的高德卫星地图。

**架构：** 将定位样本选择与地图图层模式分别放在两个纯函数模块中，以 Node 内置测试覆盖决策逻辑；`App.tsx` 只管理 Expo 定位订阅、超时与 React 状态，`DynamicVectorMap.web.tsx` 只管理高德图层实例及控件。现有 WGS84 → GCJ-02 数据流、人物匹配和标记逻辑保持不变。

**技术栈：** TypeScript、React 19、React Native Web、Expo Location 57、高德地图 JS API 2.0、Node `node:test`

---

## 文件结构

- 创建 `apps/mobile/src/location/locationSampling.ts`：转换浏览器定位对象、选择最佳样本、判断目标精度、格式化精度文案。
- 创建 `apps/mobile/test/locationSampling.test.ts`：覆盖自动采样的纯决策逻辑。
- 修改 `apps/mobile/App.tsx`：用 `watchPositionAsync` 替换单次定位，管理 15 秒采样、取消、卸载清理和进度文案。
- 创建 `apps/mobile/src/map/mapLayers.ts`：声明默认图层模式、图层键选择与模式切换。
- 创建 `apps/mobile/test/mapLayers.test.ts`：覆盖默认卫星模式及双向切换。
- 修改 `apps/mobile/src/map/DynamicVectorMap.web.tsx`：创建卫星、路网与标准图层，默认卫星，增加切换控件。
- 不修改 `apps/mobile/src/map/DynamicVectorMap.tsx`：原生端继续使用占位组件。

### 任务 1：定位样本决策模型

**文件：**
- 创建：`apps/mobile/src/location/locationSampling.ts`
- 测试：`apps/mobile/test/locationSampling.test.ts`

- [ ] **步骤 1：编写失败的定位采样测试**

创建 `apps/mobile/test/locationSampling.test.ts`：

```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { GeoPoint } from "../../../packages/nearby-core/src/index.ts";
import {
  LOCATION_SAMPLE_TIMEOUT_MS,
  LOCATION_TARGET_ACCURACY_METERS,
  formatLocationAccuracy,
  hasReachedTargetAccuracy,
  selectBestLocationSample,
  toNativeGeoPoint,
} from "../src/location/locationSampling.ts";

const point = (accuracyMeters: number): GeoPoint => ({
  latitude: 30.293312,
  longitude: 120.007986,
  accuracyMeters,
  capturedAt: "2026-07-23T10:00:00.000Z",
  coordinateSystem: "wgs84",
  source: "native",
});

describe("browser location sampling", () => {
  test("uses the first sample and only replaces it with a more accurate sample", () => {
    const first = point(120);
    const better = point(24);
    const worse = point(80);

    assert.equal(selectBestLocationSample(null, first), first);
    assert.equal(selectBestLocationSample(first, better), better);
    assert.equal(selectBestLocationSample(better, worse), better);
  });

  test("finishes early at the target accuracy", () => {
    assert.equal(LOCATION_TARGET_ACCURACY_METERS, 30);
    assert.equal(LOCATION_SAMPLE_TIMEOUT_MS, 15_000);
    assert.equal(hasReachedTargetAccuracy(point(30)), true);
    assert.equal(hasReachedTargetAccuracy(point(31)), false);
  });

  test("normalizes a browser sample as native WGS84 data", () => {
    assert.deepEqual(toNativeGeoPoint({
      coords: {
        latitude: 30.293312,
        longitude: 120.007986,
        accuracy: 42.4,
      },
      timestamp: Date.parse("2026-07-23T10:00:00.000Z"),
    }), point(42.4));
  });

  test("reports the real accuracy and warns for a coarse sample", () => {
    assert.equal(
      formatLocationAccuracy(point(42.4), "complete"),
      "网页定位完成 · 定位精度 ±42 米",
    );
    assert.equal(
      formatLocationAccuracy(point(680), "complete"),
      "网页定位完成 · 定位精度 ±680 米 · 当前浏览器仅提供粗略位置",
    );
    assert.equal(
      formatLocationAccuracy(point(80), "sampling"),
      "正在提高定位精度 · 当前 ±80 米",
    );
  });
});
```

- [ ] **步骤 2：运行测试并确认因模块缺失而失败**

运行：

```powershell
node --experimental-strip-types --test apps/mobile/test/locationSampling.test.ts
```

预期：FAIL，错误包含 `Cannot find module '../src/location/locationSampling.ts'`。

- [ ] **步骤 3：实现最小定位采样模型**

创建 `apps/mobile/src/location/locationSampling.ts`：

```ts
import type { GeoPoint } from "../../../../packages/nearby-core/src/index.ts";

export const LOCATION_TARGET_ACCURACY_METERS = 30;
export const LOCATION_SAMPLE_TIMEOUT_MS = 15_000;
const COARSE_LOCATION_ACCURACY_METERS = 100;
const UNKNOWN_LOCATION_ACCURACY_METERS = 5_000;

export interface BrowserLocationObject {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
  };
  timestamp: number;
}

export type LocationAccuracyPhase = "sampling" | "complete";

export function toNativeGeoPoint(location: BrowserLocationObject): GeoPoint {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters:
      location.coords.accuracy ?? UNKNOWN_LOCATION_ACCURACY_METERS,
    capturedAt: new Date(location.timestamp).toISOString(),
    coordinateSystem: "wgs84",
    source: "native",
  };
}

export function selectBestLocationSample(
  current: GeoPoint | null,
  candidate: GeoPoint,
): GeoPoint {
  if (!current || candidate.accuracyMeters < current.accuracyMeters) {
    return candidate;
  }

  return current;
}

export function hasReachedTargetAccuracy(location: GeoPoint): boolean {
  return location.accuracyMeters <= LOCATION_TARGET_ACCURACY_METERS;
}

export function formatLocationAccuracy(
  location: GeoPoint,
  phase: LocationAccuracyPhase,
): string {
  const accuracy = Math.round(location.accuracyMeters);
  const message = phase === "sampling"
    ? `正在提高定位精度 · 当前 ±${accuracy} 米`
    : `网页定位完成 · 定位精度 ±${accuracy} 米`;

  if (
    phase === "complete"
    && location.accuracyMeters > COARSE_LOCATION_ACCURACY_METERS
  ) {
    return `${message} · 当前浏览器仅提供粗略位置`;
  }

  return message;
}
```

- [ ] **步骤 4：运行定位采样测试并确认通过**

运行：

```powershell
node --experimental-strip-types --test apps/mobile/test/locationSampling.test.ts
```

预期：4 项测试 PASS。

- [ ] **步骤 5：提交定位模型**

```powershell
git add apps/mobile/src/location/locationSampling.ts apps/mobile/test/locationSampling.test.ts
git commit -m "feat: add browser location sampling model"
```

### 任务 2：接入自动连续定位

**文件：**
- 修改：`apps/mobile/App.tsx:1-222`
- 测试：`apps/mobile/test/locationSampling.test.ts`

- [ ] **步骤 1：扩充失败测试，锁定无样本超时文案**

在 `apps/mobile/test/locationSampling.test.ts` 的导入中加入 `LOCATION_EMPTY_TIMEOUT_MESSAGE`，并在 `describe` 内增加：

```ts
test("defines a clear timeout message when no sample arrives", () => {
  assert.equal(
    LOCATION_EMPTY_TIMEOUT_MESSAGE,
    "暂时无法获取位置，请检查浏览器定位权限",
  );
});
```

- [ ] **步骤 2：运行测试并确认常量缺失**

运行：

```powershell
node --experimental-strip-types --test apps/mobile/test/locationSampling.test.ts
```

预期：FAIL，错误指出 `LOCATION_EMPTY_TIMEOUT_MESSAGE` 未导出。

- [ ] **步骤 3：添加超时文案并改造 App 定位生命周期**

在 `apps/mobile/src/location/locationSampling.ts` 增加：

```ts
export const LOCATION_EMPTY_TIMEOUT_MESSAGE =
  "暂时无法获取位置，请检查浏览器定位权限";
```

将 `App.tsx` 的 React 导入改为：

```ts
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
```

删除文件级 `nativeLocation()`，导入定位采样模型：

```ts
import {
  LOCATION_EMPTY_TIMEOUT_MESSAGE,
  LOCATION_SAMPLE_TIMEOUT_MS,
  formatLocationAccuracy,
  hasReachedTargetAccuracy,
  selectBestLocationSample,
  toNativeGeoPoint,
} from "./src/location/locationSampling.ts";
```

在 `App()` 的 state 后增加：

```ts
const locationSubscriptionRef =
  useRef<Location.LocationSubscription | null>(null);
const locationTimerRef =
  useRef<ReturnType<typeof setTimeout> | null>(null);
const locationAbortRef = useRef<(() => void) | null>(null);

const stopNativeSampling = useCallback(() => {
  locationSubscriptionRef.current?.remove();
  locationSubscriptionRef.current = null;

  if (locationTimerRef.current) {
    clearTimeout(locationTimerRef.current);
    locationTimerRef.current = null;
  }

  locationAbortRef.current?.();
  locationAbortRef.current = null;
}, []);

useEffect(() => stopNativeSampling, [stopNativeSampling]);
```

在 `App()` 内、`locate()` 前增加以下函数。它会处理订阅创建与首个回调之间的竞态，并在重复定位时取消旧会话：

```ts
async function sampleNativeLocation(): Promise<GeoPoint> {
  stopNativeSampling();

  const permission = await Location.requestForegroundPermissionsAsync();
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

      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
      if (locationTimerRef.current) {
        clearTimeout(locationTimerRef.current);
        locationTimerRef.current = null;
      }
      locationAbortRef.current = null;

      if (error) {
        reject(error);
      } else if (best) {
        resolve(best);
      } else {
        reject(new Error(LOCATION_EMPTY_TIMEOUT_MESSAGE));
      }
    };

    locationAbortRef.current = () => {
      if (!settled) {
        settled = true;
        reject(new Error("定位已取消"));
      }
    };

    locationTimerRef.current = setTimeout(
      () => finish(),
      LOCATION_SAMPLE_TIMEOUT_MS,
    );

    void Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        distanceInterval: 0,
      },
      (sample) => {
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
      },
      (reason) => finish(new Error(reason)),
    ).then((subscription) => {
      if (settled) {
        subscription.remove();
      } else {
        locationSubscriptionRef.current = subscription;
      }
    }).catch((error: unknown) => {
      finish(error instanceof Error ? error : new Error("定位失败"));
    });
  });
}
```

将 `locate()` 的定位分支替换为：

```ts
const nextLocation = selectedMode === "native"
  ? await sampleNativeLocation()
  : await demoProvider.advance();

setLocation(nextLocation);
setMessage(
  selectedMode === "native"
    ? formatLocationAccuracy(nextLocation, "complete")
    : "模拟定位 · 地图已更新",
);
```

并在 `locate()` 开头处理模式切换：

```ts
if (selectedMode !== "native") {
  stopNativeSampling();
}
```

错误分支对取消会话不触发警告震动：

```ts
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : "定位失败";
  if (errorMessage !== "定位已取消") {
    setMessage(errorMessage);
    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Warning,
    );
  }
```

- [ ] **步骤 4：运行定位测试、全量测试和类型检查**

运行：

```powershell
node --experimental-strip-types --test apps/mobile/test/locationSampling.test.ts
npm test
npm run typecheck
```

预期：定位测试 5 项 PASS；全量测试全部 PASS；`tsc -b` 退出码为 0。

- [ ] **步骤 5：提交自动定位**

```powershell
git add apps/mobile/App.tsx apps/mobile/src/location/locationSampling.ts apps/mobile/test/locationSampling.test.ts
git commit -m "feat: sample browser location for better accuracy"
```

### 任务 3：地图图层模式模型

**文件：**
- 创建：`apps/mobile/src/map/mapLayers.ts`
- 测试：`apps/mobile/test/mapLayers.test.ts`

- [ ] **步骤 1：编写失败的图层模式测试**

创建 `apps/mobile/test/mapLayers.test.ts`：

```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  DEFAULT_MAP_LAYER_MODE,
  getMapLayerKeys,
  toggleMapLayerMode,
} from "../src/map/mapLayers.ts";

describe("map layer mode", () => {
  test("defaults to satellite with road labels", () => {
    assert.equal(DEFAULT_MAP_LAYER_MODE, "satellite");
    assert.deepEqual(
      getMapLayerKeys(DEFAULT_MAP_LAYER_MODE),
      ["satellite", "roadnet"],
    );
  });

  test("uses only the standard layer in standard mode", () => {
    assert.deepEqual(getMapLayerKeys("standard"), ["standard"]);
  });

  test("toggles between satellite and standard modes", () => {
    assert.equal(toggleMapLayerMode("satellite"), "standard");
    assert.equal(toggleMapLayerMode("standard"), "satellite");
  });
});
```

- [ ] **步骤 2：运行测试并确认因模块缺失而失败**

运行：

```powershell
node --experimental-strip-types --test apps/mobile/test/mapLayers.test.ts
```

预期：FAIL，错误包含 `Cannot find module '../src/map/mapLayers.ts'`。

- [ ] **步骤 3：实现最小图层模式模型**

创建 `apps/mobile/src/map/mapLayers.ts`：

```ts
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
```

- [ ] **步骤 4：运行图层模式测试并确认通过**

运行：

```powershell
node --experimental-strip-types --test apps/mobile/test/mapLayers.test.ts
```

预期：3 项测试 PASS。

- [ ] **步骤 5：提交图层模式模型**

```powershell
git add apps/mobile/src/map/mapLayers.ts apps/mobile/test/mapLayers.test.ts
git commit -m "feat: add satellite and standard map layer modes"
```

### 任务 4：接入默认卫星地图和切换控件

**文件：**
- 修改：`apps/mobile/src/map/DynamicVectorMap.web.tsx:18-392`
- 测试：`apps/mobile/test/mapLayers.test.ts`

- [ ] **步骤 1：扩充失败测试，锁定切换控件文案**

在 `apps/mobile/test/mapLayers.test.ts` 的导入中加入 `getMapLayerToggleLabel`，并增加：

```ts
test("labels the button with the target layer mode", () => {
  assert.equal(getMapLayerToggleLabel("satellite"), "切换到标准地图");
  assert.equal(getMapLayerToggleLabel("standard"), "切换到卫星地图");
});
```

- [ ] **步骤 2：运行测试并确认函数缺失**

运行：

```powershell
node --experimental-strip-types --test apps/mobile/test/mapLayers.test.ts
```

预期：FAIL，错误指出 `getMapLayerToggleLabel` 未导出。

- [ ] **步骤 3：实现文案并接入高德图层**

在 `apps/mobile/src/map/mapLayers.ts` 增加：

```ts
export function getMapLayerToggleLabel(mode: MapLayerMode): string {
  return mode === "satellite" ? "切换到标准地图" : "切换到卫星地图";
}
```

在 `DynamicVectorMap.web.tsx` 导入：

```ts
import {
  DEFAULT_MAP_LAYER_MODE,
  getMapLayerKeys,
  getMapLayerToggleLabel,
  toggleMapLayerMode,
  type MapLayerKey,
} from "./mapLayers.ts";
```

扩充 `AmapRuntime`：

```ts
interface AmapRuntime {
  Map: typeof AMap.Map;
  Marker: typeof AMap.Marker;
  TileLayer: typeof AMap.TileLayer;
  createDefaultLayer: typeof AMap.createDefaultLayer;
}
```

在组件 refs/state 中增加：

```ts
const mapLayersRef = useRef<Record<MapLayerKey, AMap.TileLayer> | null>(null);
const [layerMode, setLayerMode] = useState(DEFAULT_MAP_LAYER_MODE);
```

在创建 `AMap.Map` 前创建图层，并将默认卫星与路网传给地图：

```ts
const mapLayers: Record<MapLayerKey, AMap.TileLayer> = {
  standard: runtime.createDefaultLayer(),
  satellite: new runtime.TileLayer.Satellite({ detectRetina: true }),
  roadnet: new runtime.TileLayer.RoadNet({ detectRetina: true }),
};
const initialLayers = getMapLayerKeys(DEFAULT_MAP_LAYER_MODE)
  .map((key) => mapLayers[key]);

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
  layers: initialLayers,
});
mapLayersRef.current = mapLayers;
```

在地图销毁时增加：

```ts
mapLayersRef.current = null;
```

增加图层模式 effect；它只调用 `setLayers`，不会重建地图：

```ts
useEffect(() => {
  const map = mapRef.current;
  const layers = mapLayersRef.current;
  if (status !== "ready" || !map || !layers) {
    return;
  }

  map.setLayers(getMapLayerKeys(layerMode).map((key) => layers[key]));
}, [layerMode, status]);
```

在 `locationControls` 的“湖畔”按钮前增加：

```tsx
<MapControl
  label={getMapLayerToggleLabel(layerMode)}
  selected={layerMode === "satellite"}
  text={layerMode === "satellite" ? "卫星" : "标准"}
  onPress={() => setLayerMode(toggleMapLayerMode)}
/>
```

扩充 `MapControl`：

```tsx
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
```

增加选中样式：

```ts
controlSelected: {
  backgroundColor: "rgba(36, 95, 150, 0.94)",
  borderColor: "#69f0ae",
},
```

- [ ] **步骤 4：运行图层测试、全量测试、类型检查和构建**

运行：

```powershell
node --experimental-strip-types --test apps/mobile/test/mapLayers.test.ts
npm test
npm run typecheck
npm run build:web
git diff --check
```

预期：图层测试 4 项 PASS；全量测试全部 PASS；类型检查和 Web 构建退出码为 0；`git diff --check` 无输出。

- [ ] **步骤 5：提交卫星地图 UI**

```powershell
git add apps/mobile/src/map/mapLayers.ts apps/mobile/src/map/DynamicVectorMap.web.tsx apps/mobile/test/mapLayers.test.ts
git commit -m "feat: default to switchable satellite map"
```

### 任务 5：浏览器验收与分支推送

**文件：**
- 验证：`dist/web`
- 检查：`apps/mobile/.env.local`

- [ ] **步骤 1：确认环境变量文件存在且未被 Git 跟踪**

运行：

```powershell
Test-Path apps/mobile/.env.local
git check-ignore -v apps/mobile/.env.local
```

预期：第一条输出 `True`；第二条显示 `.gitignore` 规则，命令不得打印变量值。

- [ ] **步骤 2：运行最终自动化验证**

运行：

```powershell
npm test
npm run typecheck
npm run build:web
git diff --check
git status --short --branch
```

预期：全部测试 PASS；类型检查和构建成功；没有未提交改动。

- [ ] **步骤 3：启动本地静态预览并在浏览器验收**

使用独立端口提供 `dist/web`，然后验证：

1. 初始底图为卫星影像并显示道路/地名；
2. “卫星”控件切换到标准图后，地图中心、缩放和人物标记不丢失；
3. 再切回卫星图成功；
4. 拖动、滚轮缩放、触摸缩放和人物标记选择仍可使用；
5. 点击 GPS 后显示“正在提高定位精度”；
6. 有样本后文案显示 `±N 米`；
7. 达到 30 米或等待 15 秒后停止 loading；
8. 粗略位置超过 100 米时显示明确警告。

- [ ] **步骤 4：推送功能分支**

运行：

```powershell
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin codex/dynamic-vector-map
```

预期：远端 `codex/dynamic-vector-map` 更新成功；不得推送 `master`。
