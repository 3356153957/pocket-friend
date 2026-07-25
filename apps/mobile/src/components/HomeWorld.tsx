import { ArrowLeft, DoorOpen, Heart, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  fallbackProductScenes,
  type ProductScene,
} from "../app/productApi.ts";
import {
  fetchHardwarePhotoCandidates,
  makePhotoApiUrl,
  processHardwarePhotoCandidate,
  type DownloadedPhoto,
  type HardwarePhotoCandidate,
} from "../app/photoPipeline.ts";
import {
  createPlaceholderResidentFromPhoto,
  needsPixelGeneration,
  normalizeManagedPhotoName,
  residentIdForPhoto,
  syncPhotoResidents,
  type ManagedPhotoResident,
} from "../app/photoResidentSync.ts";
import type { ScreenResident } from "../app/screenResident.ts";
import { residentsForScene } from "../app/sceneResidents.ts";
import InteractiveIsland, { type IslandPal, type IslandSceneConfig } from "./InteractiveIsland.tsx";
import { PixelCard, PixelLabel } from "./PixelUi.tsx";

const palColors = [
  { hair: "#f472b6", body: "#ec4899", bg: "bg-pink" },
  { hair: "#38bdf8", body: "#0ea5e9", bg: "bg-cyan" },
  { hair: "#84cc16", body: "#a3e635", bg: "bg-lime" },
  { hair: "#c084fc", body: "#a855f7", bg: "bg-card" },
] as const;

const LOCAL_PHOTO_RESIDENTS_KEY = "pf:island-photo-residents:v1";
const LOCAL_PHOTO_KNOWN_IDS_KEY = "pf:island-photo-known-ids:v1";

const OUTER_ISLAND_SCENE_CONFIG: IslandSceneConfig = {
  src: "/assets/scene-hackathon.png",
  label: "HACKATHON ISLAND",
  walk: { x1: 0.10, x2: 0.91, y1: 0.26, y2: 0.88 },
};

const outerPalPositions = [
  { rx: 0.49, ry: 0.56 },
  { rx: 0.31, ry: 0.61 },
  { rx: 0.69, ry: 0.58 },
  { rx: 0.45, ry: 0.73 },
  { rx: 0.57, ry: 0.40 },
  { rx: 0.22, ry: 0.48 },
] as const;

const scenePalPositions = [
  { rx: 0.46, ry: 0.66 },
  { rx: 0.58, ry: 0.58 },
  { rx: 0.34, ry: 0.72 },
  { rx: 0.68, ry: 0.50 },
  { rx: 0.50, ry: 0.76 },
  { rx: 0.26, ry: 0.58 },
] as const;

function labelFromName(name: string) {
  return Array.from(name.trim())[0]?.toUpperCase() ?? "P";
}

function formatMetAt(createdAt?: string) {
  if (!createdAt) return "pocket friend";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "pocket friend";
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function sceneSlot(sceneId: string) {
  const order = fallbackProductScenes.findIndex((scene) => scene.id === sceneId);
  return order >= 0 ? order : 0;
}

function palFromResident(resident: ScreenResident, index: number, sceneId?: string): IslandPal {
  const color = palColors[index % palColors.length] ?? palColors[0];
  const positionList = sceneId ? scenePalPositions : outerPalPositions;
  const position = positionList[index % positionList.length] ?? { rx: 0.5, ry: 0.62 };
  const isDemo = resident.source === "demo";
  const isGenerating = !isDemo && resident.needsSeedream === true;
  const statusTags = isDemo
    ? ["等待硬件照片", "尚未保存居民"]
    : resident.warning
      ? [...resident.tags, "需要检查 Seedream"]
      : resident.tags.length
        ? resident.tags
        : ["小岛", "像素朋友"];
  const bio = isDemo
    ? "尚未保存真实硬件照片。拍摄照片后即可生成居民。"
      : resident.warning
        ? resident.warning
      : isGenerating
        ? "已读取真实硬件照片，正在调用 Seedream 生成像素小人。"
        : resident.spriteSource === "seedream"
          ? `${resident.magnetType}。已识别真实照片，像素形象已进入场景。`
          : `${resident.magnetType}。已识别真实照片，先以真人照片形象进入场景。`;
  const pal: IslandPal = {
    id: resident.id,
    name: isDemo ? "等待中" : resident.name,
    label: labelFromName(isDemo ? "等待中" : resident.name),
    hair: color.hair,
    body: color.body,
    tags: statusTags,
    bio,
    metAt: formatMetAt(resident.createdAt),
    rx: position.rx,
    ry: position.ry,
    spriteSource: resident.spriteSource,
    spriteRotation: resident.spriteRotation ?? 0,
    realPhotoRotation: resident.realPhotoRotation ?? 0,
  };
  if (resident.pixelPortraitUrl) pal.spriteUrl = resident.pixelPortraitUrl;
  if (resident.portraitUrl) pal.realPhotoUrl = resident.portraitUrl;
  return pal;
}

function fallbackPal(): IslandPal {
  return {
    id: "local-preview",
    name: "等待中",
    label: "等",
    hair: "#f472b6",
    body: "#ec4899",
    tags: ["等待照片", "像素居民"],
    bio: "硬件拍照后，生成的像素朋友会出现在这里。",
    metAt: "pocket friend",
    rx: 0.5,
    ry: 0.62,
    spriteSource: "local-fallback",
    spriteRotation: 0,
    realPhotoRotation: 0,
  };
}

function mergeResidents(backendResidents: ScreenResident[]) {
  const merged = new Map<string, ScreenResident>();
  for (const item of backendResidents) merged.set(item.id, item);
  return [...merged.values()];
}

function hasGeneratedIslandSprite(resident: ScreenResident) {
  if (resident.source !== "hardware") return false;
  if (!resident.pixelPortraitUrl) return false;
  if (resident.spriteSource === "seedream") return true;
  return /^(data:image\/|blob:|https?:\/\/|\/photo-api\/)/iu.test(resident.pixelPortraitUrl);
}

function readCachedPhotoResidents(): ManagedPhotoResident[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_PHOTO_RESIDENTS_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ManagedPhotoResident => (
      typeof item === "object" &&
      item !== null &&
      typeof (item as { id?: unknown }).id === "string" &&
      typeof (item as { name?: unknown }).name === "string" &&
      typeof (item as { pixelPortraitUrl?: unknown }).pixelPortraitUrl === "string" &&
      (item as { source?: unknown }).source === "hardware"
    ));
  } catch {
    return [];
  }
}

function writeCachedPhotoResidents(residents: ManagedPhotoResident[]) {
  try {
    window.localStorage.setItem(LOCAL_PHOTO_RESIDENTS_KEY, JSON.stringify(residents));
  } catch {
    // Storage can be full on some mobile browsers; the island can still render in memory.
  }
}

function readKnownPhotoIds(): Set<string> | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_PHOTO_KNOWN_IDS_KEY) ?? "null") as unknown;
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.filter((item): item is string => typeof item === "string" && item.length > 0));
  } catch {
    return null;
  }
}

function writeKnownPhotoIds(ids: ReadonlySet<string>) {
  try {
    window.localStorage.setItem(LOCAL_PHOTO_KNOWN_IDS_KEY, JSON.stringify([...ids]));
  } catch {
    // Seen-photo cache is only an API-throttling aid; rendering can continue without it.
  }
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : "未知错误";
}

function residentFromDownloadedPhoto(
  photo: DownloadedPhoto,
  candidate: HardwarePhotoCandidate,
  index: number,
  sceneIds: string[],
): ManagedPhotoResident {
  const sceneId = sceneIds[index % Math.max(1, sceneIds.length)] ?? "venture-center";
  return {
    id: residentIdForPhoto(candidate),
    name: photo.name ?? "硬件照片",
    magnetType: "好奇选手",
    tags: [photo.spriteSource === "seedream" ? "Seedream像素小人" : "真人照片兜底", "4311照片"],
    portraitUrl: photo.originalUrl ?? makePhotoApiUrl(candidate.url),
    pixelPortraitUrl: photo.pixelPortraitUrl,
    createdAt: photo.capturedAt,
    updatedAt: new Date().toISOString(),
    source: "hardware",
    spriteSource: photo.spriteSource,
    activeSceneId: sceneId,
    needsSeedream: false,
    spriteRotation: 0,
    realPhotoRotation: 180,
    ...(photo.seedreamModel ? { seedreamModel: photo.seedreamModel } : {}),
    ...(photo.warning ? { warning: photo.warning } : {}),
  };
}

function upsertPhotoResident(
  current: ScreenResident[],
  resident: ManagedPhotoResident,
): ManagedPhotoResident[] {
  const found = current.some((item) => item.id === resident.id);
  const next = found
    ? current.map((item) => item.id === resident.id ? resident : item)
    : [...current, resident];
  writeCachedPhotoResidents(next as ManagedPhotoResident[]);
  return next as ManagedPhotoResident[];
}

function sceneConfigFromProduct(scene: ProductScene): IslandSceneConfig {
  const config: IslandSceneConfig = {
    src: scene.assetUrl,
    label: scene.shortName || scene.name,
    walk: scene.walk,
  };
  if (scene.sceneKind) config.kind = scene.sceneKind;
  return config;
}

function OuterIsland({
  scenes,
  pals,
  selectedId,
  onEnter,
  onSelect,
  compact = false,
}: {
  scenes: ProductScene[];
  pals: IslandPal[];
  selectedId: string;
  onEnter: (scene: ProductScene) => void;
  onSelect: (palId: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-ink">
      <InteractiveIsland
        sceneConfig={OUTER_ISLAND_SCENE_CONFIG}
        pals={pals}
        selectedId={selectedId}
        onSelect={onSelect}
        compact={compact}
      />
      <div className="pointer-events-none absolute left-2 top-2 border-2 border-ink bg-lime px-2 py-1 font-pixel text-[7px] shadow-[2px_2px_0_var(--ink)]">
        好友小岛
      </div>
      {scenes.map((scene, index) => (
        <button
          type="button"
          key={scene.id}
          onClick={() => onEnter(scene)}
          aria-label={`进入${scene.name}`}
          className="group absolute h-16 w-20 -translate-x-1/2 -translate-y-1/2 bg-transparent p-0"
          style={{ left: `${scene.outerX * 100}%`, top: `${scene.outerY * 100}%` }}
        >
          <span className="pointer-events-none absolute left-1/2 top-0 max-w-[94px] -translate-x-1/2 -translate-y-full whitespace-nowrap border-2 border-ink bg-card px-1.5 py-0.5 text-center font-mono-pixel text-xs leading-3 text-ink shadow-[1px_1px_0_var(--ink)] group-hover:bg-lime">
            {scene.shortName}
          </span>
          <span className={`pointer-events-none absolute left-1/2 top-1/2 grid h-4 w-4 -translate-x-1/2 -translate-y-1/2 place-items-center border-2 border-ink ${palColors[index % palColors.length]?.bg ?? "bg-pink"} shadow-[1px_1px_0_var(--ink)]`}>
            <span className="h-1.5 w-1.5 bg-ink" />
          </span>
        </button>
      ))}
      <div className="pointer-events-none absolute bottom-2 left-2 right-14 border-2 border-ink bg-mint px-2 py-1 font-pixel text-[6px] leading-3 shadow-[2px_2px_0_var(--ink)]">
        点击建筑进入 · 点击小人看名片
      </div>
    </div>
  );
}

function SceneBackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="absolute left-3 top-3 z-10 inline-flex min-h-9 items-center gap-1 border-2 border-ink bg-lime px-2 py-1 font-pixel text-[7px] text-ink shadow-[2px_2px_0_var(--ink)]"
    >
      <ArrowLeft size={14} /> 返回
    </button>
  );
}

export default function HomeWorld({ resident }: { resident?: ScreenResident | null | undefined }) {
  const [scenes, setScenes] = useState<ProductScene[]>(fallbackProductScenes);
  const [backendResidents, setBackendResidents] = useState<ScreenResident[]>([]);
  const [activeScene, setActiveScene] = useState<ProductScene | null>(null);
  const [selectedId, setSelectedId] = useState(resident?.id ?? "local-preview");
  const [landscape, setLandscape] = useState(false);
  const [backendNotice, setBackendNotice] = useState<string | null>(null);
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);
  const generationQueueRef = useRef(Promise.resolve());
  const generatingPhotoIdsRef = useRef(new Set<string>());
  const knownPhotoIdsRef = useRef<Set<string> | null>(null);

  async function refreshWorld() {
    try {
      const managedPhotos = await fetchHardwarePhotoCandidates();
      const nextScenes = fallbackProductScenes;
      const sceneIds = nextScenes.map((scene) => scene.id);
      const photoIds = managedPhotos.map((photo) => photo.id).filter(Boolean);
      let knownPhotoIds = knownPhotoIdsRef.current ?? readKnownPhotoIds();
      let initializedFromHistory = false;
      let newArrival: HardwarePhotoCandidate | null = null;

      if (knownPhotoIds === null) {
        knownPhotoIds = new Set(photoIds);
        initializedFromHistory = true;
      } else {
        newArrival = managedPhotos.find((photo) => !knownPhotoIds!.has(photo.id)) ?? null;
        if (newArrival) knownPhotoIds.add(newArrival.id);
      }

      knownPhotoIdsRef.current = knownPhotoIds;
      writeKnownPhotoIds(knownPhotoIds);

      const syncedResidents = syncPhotoResidents(
        readCachedPhotoResidents(),
        managedPhotos,
        (photo, index) => createPlaceholderResidentFromPhoto(
          photo,
          index,
          makePhotoApiUrl(photo.url ?? ""),
          sceneIds,
        ),
      );
      const newArrivalId = newArrival ? residentIdForPhoto(newArrival) : null;
      const residentsForState = newArrivalId
        ? syncedResidents.map((item) => item.id === newArrivalId
          ? { ...item, needsSeedream: true, tags: Array.from(new Set([...item.tags, "Seedream生成中"])) }
          : item)
        : syncedResidents;

      setScenes(nextScenes);
      setBackendResidents(residentsForState);
      writeCachedPhotoResidents(residentsForState);
      setBackendNotice(null);
      setPhotoNotice(managedPhotos.length
        ? initializedFromHistory
          ? `4311 已读取 ${managedPhotos.length} 张历史照片，已作为初始居民保存；后续只处理新照片。`
          : newArrival
            ? `4311 发现新照片 ${normalizeManagedPhotoName(newArrival.name ?? newArrival.id)}，正在单张生成。`
            : `4311 已读取 ${managedPhotos.length} 张硬件照片，名字来自照片文件名。`
        : "4311 暂无硬件照片，等待硬件上传。");
      if (!managedPhotos.length) setGenerationNotice(null);
      enqueuePhotoGeneration(newArrival ? [newArrival] : [], residentsForState, sceneIds);
    } catch (error) {
      setScenes(fallbackProductScenes);
      const cached = readCachedPhotoResidents();
      if (cached.length) setBackendResidents(cached);
      setBackendNotice("正在使用本地缓存");
      setPhotoNotice(`4311 照片读取失败：${readableError(error)}`);
    }
  }

  function enqueuePhotoGeneration(
    newestFirst: HardwarePhotoCandidate[],
    residents: ManagedPhotoResident[],
    sceneIds: string[],
  ) {
    const residentsById = new Map(residents.map((item) => [item.id, item]));
    const missing = newestFirst.filter((photo) => {
      const current = residentsById.get(residentIdForPhoto(photo));
      return current && needsPixelGeneration(current) && !generatingPhotoIdsRef.current.has(photo.id);
    });

    missing.forEach((candidate, index) => {
      generatingPhotoIdsRef.current.add(candidate.id);
      generationQueueRef.current = generationQueueRef.current
        .then(async () => {
          const displayName = normalizeManagedPhotoName(candidate.name ?? candidate.id);
          setGenerationNotice(`Seedream 正在生成 ${displayName} 的像素小人。`);
          const showOnIsland = (photo: DownloadedPhoto) => {
            const resident = residentFromDownloadedPhoto(photo, candidate, index, sceneIds);
            setBackendResidents((current) => upsertPhotoResident(current, resident));
          };
          const processed = await processHardwarePhotoCandidate(candidate, (progress) => {
            if (progress.stage !== "potato-ready") return;
            setGenerationNotice(`已读取 ${displayName}，Seedream 正在继续生成。`);
          });
          showOnIsland(processed);
          setGenerationNotice(processed.warning
            ? `Seedream 生成失败：${processed.warning}`
            : `Seedream 已生成 ${processed.name ?? displayName} 的像素小人。`);
        })
        .catch((error) => {
          setGenerationNotice(`Seedream 生成失败：${readableError(error)}`);
        })
        .finally(() => {
          generatingPhotoIdsRef.current.delete(candidate.id);
        });
    });
  }

  useEffect(() => {
    void refreshWorld();
    const timer = window.setInterval(() => void refreshWorld(), 3000);
    return () => window.clearInterval(timer);
  }, []);

  const allResidents = useMemo(() => mergeResidents(backendResidents), [backendResidents]);
  const currentSceneId = activeScene?.id;
  const sceneResidents = useMemo(() => {
    if (!currentSceneId) return allResidents;
    return residentsForScene(currentSceneId, allResidents);
  }, [allResidents, currentSceneId]);
  const visibleResidents = (activeScene ? sceneResidents : allResidents).filter(hasGeneratedIslandSprite);
  const pals = useMemo(() => {
    const list = visibleResidents.map((item, index) => palFromResident(item, index + sceneSlot(currentSceneId ?? ""), currentSceneId));
    return list;
  }, [currentSceneId, resident, visibleResidents]);
  const hasPals = pals.length > 0;
  const selected = pals.find((pal) => pal.id === selectedId) ?? pals[0] ?? fallbackPal();
  const selectedIndex = Math.max(0, pals.findIndex((pal) => pal.id === selected.id));
  const selectedColor = palColors[selectedIndex % palColors.length] ?? palColors[0];
  const activeSceneConfig = useMemo(() => activeScene ? sceneConfigFromProduct(activeScene) : undefined, [activeScene]);

  useEffect(() => {
    if (!pals.some((pal) => pal.id === selectedId)) {
      setSelectedId(pals[0]?.id ?? "local-preview");
    }
  }, [pals, selectedId]);

  function enterScene(scene: ProductScene) {
    setActiveScene(scene);
    setSelectedId(resident?.id ?? pals[0]?.id ?? "local-preview");
  }

  function leaveScene() {
    setActiveScene(null);
  }

  const sceneTitle = activeScene ? activeScene.name : "好友小岛";

  return (
    <section className="space-y-3 px-3 py-4">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-pixel text-[10px]">pocket friend</h1>
          <p className="truncate font-mono-pixel text-sm text-ink/70">
            {activeScene ? `${activeScene.shortName} · ${pals.length} 位居民` : "好友小岛 · 选择一座建筑"}
          </p>
        </div>
        <div className="flex gap-1">
          {activeScene && (
            <button type="button" aria-label="返回小岛总览" onClick={leaveScene} className="pixel-icon-button bg-card">
              <ArrowLeft size={16} />
            </button>
          )}
          <button type="button" aria-label="刷新居民数据" onClick={() => void refreshWorld()} className="pixel-icon-button bg-card">
            <RefreshCw size={15} />
          </button>
          <button type="button" aria-label="横屏查看小岛" onClick={() => setLandscape(true)} className="pixel-icon-button bg-card">
            <Maximize2 size={16} />
          </button>
        </div>
      </header>

      <div className="pixel-border-sm relative h-[285px] overflow-hidden bg-ink">
        {activeScene && activeSceneConfig ? (
          <>
            <InteractiveIsland sceneConfig={activeSceneConfig} pals={pals} selectedId={selected.id} onSelect={setSelectedId} compact />
            <SceneBackButton onBack={leaveScene} />
          </>
        ) : (
          <OuterIsland scenes={scenes} pals={pals} selectedId={selected.id} onSelect={setSelectedId} onEnter={enterScene} compact />
        )}
        {!hasPals && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 max-w-[82%] -translate-x-1/2 -translate-y-1/2 border-2 border-ink bg-card px-3 py-2 text-center font-pixel text-[7px] leading-4 text-ink shadow-[2px_2px_0_var(--ink)]">
            4311 暂无硬件照片，等待相机上传。收到新照片后会单张调用 Seedream；失败时直接用真人照片入岛。
          </div>
        )}
        <button
          type="button"
          aria-label="横屏查看小岛"
          onClick={() => setLandscape(true)}
          className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center border-2 border-ink bg-lime shadow-[2px_2px_0_var(--ink)]"
        >
          <Maximize2 size={18} />
        </button>
      </div>

      <PixelCard>
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="grid h-12 w-12 place-items-center overflow-hidden border-[3px] border-ink bg-card font-pixel text-[8px]">
              {selected.realPhotoUrl ? <img src={selected.realPhotoUrl} alt={`${selected.name}的真实照片`} className="h-full w-full object-cover" style={{ transform: selected.realPhotoRotation === 180 ? "rotate(180deg)" : undefined }} /> : "原图"}
            </div>
            <div className={`grid h-12 w-12 place-items-center overflow-hidden border-[3px] border-ink ${selectedColor.bg} font-pixel text-[10px]`}>
              {selected.spriteUrl ? <img src={selected.spriteUrl} alt={`${selected.name}的像素形象`} className="h-full w-full object-contain pixel-image" style={{ transform: selected.spriteRotation === 180 ? "rotate(180deg)" : undefined }} /> : selected.label}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-pixel text-[10px]">{selected.name}</h2>
            <p className="truncate font-mono-pixel text-sm text-ink/70">{selected.tags.slice(0, 3).join(" · ")}</p>
            <p className="mt-1 font-pixel text-[6px] text-ink/55">
              {selected.tags.some((tag) => tag.includes("正在生成"))
                ? "Seedream 正在生成"
                : selected.tags.some((tag) => tag.includes("失败"))
                  ? "Seedream 生成失败"
                  : selected.spriteSource === "seedream" ? "Seedream 像素形象" : "真人照片形象"}
            </p>
            <p className="mt-1 font-pixel text-[6px] text-ink/55">{sceneTitle}</p>
          </div>
          <Heart size={22} fill="var(--pink)" color="var(--ink)" aria-hidden="true" />
        </div>
        <p className="mt-3 border-2 border-ink bg-mint p-2 font-mono-pixel text-sm leading-5">{selected.bio}</p>
        <p className="mt-2 font-pixel text-[7px] text-ink/60">相遇于 · {selected.metAt}</p>
        {photoNotice && <p className="mt-2 font-pixel text-[6px] leading-3 text-ink/60">{photoNotice}</p>}
        {generationNotice && <p className="mt-1 font-pixel text-[6px] leading-3 text-ink/60">{generationNotice}</p>}
        {backendNotice && <p className="mt-2 font-pixel text-[6px] text-ink/50">{backendNotice}</p>}
      </PixelCard>

      <div>
        <PixelLabel>{activeScene ? "场景居民" : "场景入口"}</PixelLabel>
        <div className="mt-2 space-y-2">
          {activeScene ? (
            pals.map((pal, index) => {
              const color = palColors[index % palColors.length] ?? palColors[0];
              return (
                <button type="button" key={pal.id} onClick={() => setSelectedId(pal.id)} className={`pixel-setting-row ${selected.id === pal.id ? "bg-pink" : "bg-card"}`}>
                  <span className={`grid h-8 w-8 place-items-center overflow-hidden border-2 border-ink ${color.bg} font-pixel text-[7px]`}>
                    {pal.spriteUrl ? <img src={pal.spriteUrl} alt="" className="h-full w-full object-contain pixel-image" style={{ transform: pal.spriteRotation === 180 ? "rotate(180deg)" : undefined }} /> : pal.label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-pixel text-[8px]">{pal.name}</span>
                    <span className="block truncate font-mono-pixel text-sm text-ink/70">{pal.tags.slice(0, 3).join(" · ")}</span>
                  </span>
                  <span aria-hidden="true">&gt;</span>
                </button>
              );
            })
          ) : (
            scenes.map((scene) => (
              <button type="button" key={scene.id} onClick={() => enterScene(scene)} className="pixel-setting-row bg-card">
                <DoorOpen size={18} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-pixel text-[8px]">{scene.shortName}</span>
                  <span className="block truncate font-mono-pixel text-sm text-ink/70">{scene.description}</span>
                </span>
                <span aria-hidden="true">&gt;</span>
              </button>
            ))
          )}
        </div>
      </div>

      {landscape && (
        <div className="fixed inset-0 z-50 bg-ink p-3">
          <div className="relative h-full overflow-hidden border-[3px] border-lime bg-ink shadow-[4px_4px_0_var(--lime)]">
            {activeScene && activeSceneConfig ? (
              <>
                <InteractiveIsland sceneConfig={activeSceneConfig} pals={pals} selectedId={selected.id} onSelect={setSelectedId} />
                <SceneBackButton onBack={leaveScene} />
              </>
            ) : (
              <OuterIsland scenes={scenes} pals={pals} selectedId={selected.id} onSelect={setSelectedId} onEnter={enterScene} />
            )}
            {!hasPals && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 max-w-[78%] -translate-x-1/2 -translate-y-1/2 border-2 border-ink bg-card px-4 py-3 text-center font-pixel text-[8px] leading-5 text-ink shadow-[2px_2px_0_var(--ink)]">
                4311 暂无硬件照片，等待相机上传。收到新照片后会单张调用 Seedream；失败时直接用真人照片入岛。
              </div>
            )}
            {!activeScene && (
              <div className="absolute left-3 top-3 border-2 border-ink bg-lime px-3 py-2 font-pixel text-[8px] text-ink shadow-[2px_2px_0_var(--ink)]">
                好友小岛
              </div>
            )}
            <button
              type="button"
              aria-label="退出横屏"
              onClick={() => setLandscape(false)}
              className="absolute bottom-3 right-3 grid h-11 w-11 place-items-center border-2 border-ink bg-pink shadow-[2px_2px_0_var(--ink)]"
            >
              <Minimize2 size={18} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
