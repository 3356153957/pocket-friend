import { ArrowLeft, DoorOpen, Heart, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  fallbackProductScenes,
  listProductResidents,
  listProductScenes,
  toScreenResident,
  type ProductResident,
  type ProductScene,
} from "../app/productApi.ts";
import type { ScreenResident } from "../app/screenResident.ts";
import InteractiveIsland, { type IslandPal, type IslandSceneConfig } from "./InteractiveIsland.tsx";
import { PixelCard, PixelLabel } from "./PixelUi.tsx";

const palColors = [
  { hair: "#f472b6", body: "#ec4899", bg: "bg-pink" },
  { hair: "#38bdf8", body: "#0ea5e9", bg: "bg-cyan" },
  { hair: "#84cc16", body: "#a3e635", bg: "bg-lime" },
  { hair: "#c084fc", body: "#a855f7", bg: "bg-card" },
] as const;

function labelFromName(name: string) {
  return Array.from(name.trim())[0]?.toUpperCase() ?? "P";
}

function formatMetAt(createdAt?: string) {
  if (!createdAt) return "Pocket Friend";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "Pocket Friend";
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function sceneSlot(sceneId: string) {
  const order = fallbackProductScenes.findIndex((scene) => scene.id === sceneId);
  return order >= 0 ? order : 0;
}

function palFromResident(resident: ScreenResident, index: number, sceneId?: string): IslandPal {
  const color = palColors[index % palColors.length] ?? palColors[0];
  const baseX = [0.46, 0.58, 0.34, 0.68][index % 4] ?? 0.5;
  const baseY = [0.66, 0.58, 0.72, 0.50][index % 4] ?? 0.62;
  const pal: IslandPal = {
    id: resident.id,
    name: resident.name,
    label: labelFromName(resident.name),
    hair: color.hair,
    body: color.body,
    tags: resident.tags.length ? resident.tags : ["入岛", "像素小人"],
    bio: `${resident.magnetType}。真人照片已识别，Seedream 像素小人已进入场景。`,
    metAt: formatMetAt(resident.createdAt),
    rx: sceneId ? baseX : 0.50,
    ry: sceneId ? baseY : 0.60,
  };
  if (resident.pixelPortraitUrl) pal.spriteUrl = resident.pixelPortraitUrl;
  if (resident.portraitUrl) pal.realPhotoUrl = resident.portraitUrl;
  return pal;
}

function fallbackPal(): IslandPal {
  return {
    id: "local-preview",
    name: "Luna",
    label: "L",
    hair: "#f472b6",
    body: "#ec4899",
    tags: ["等待硬件照片", "像素居民"],
    bio: "完成照片采集后，真实像素小人会出现在这里。",
    metAt: "Pocket Friend",
    rx: 0.5,
    ry: 0.62,
  };
}

function mergeResidents(current: ScreenResident | null | undefined, backendResidents: ProductResident[]) {
  const merged = new Map<string, ScreenResident>();
  for (const resident of backendResidents) merged.set(resident.id, toScreenResident(resident));
  if (current) merged.set(current.id, current);
  return [...merged.values()];
}

function sceneConfigFromProduct(scene: ProductScene): IslandSceneConfig {
  return {
    src: scene.assetUrl,
    label: scene.shortName || scene.name,
    walk: scene.walk,
  };
}

function OuterIsland({
  scenes,
  onEnter,
  compact = false,
}: {
  scenes: ProductScene[];
  onEnter: (scene: ProductScene) => void;
  compact?: boolean;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-ink">
      <img
        src="/assets/scene-hackathon.png"
        alt="Pocket Friend island overview"
        className="h-full w-full object-cover pixel-image"
      />
      <div className="absolute left-2 top-2 border-2 border-ink bg-lime px-2 py-1 font-pixel text-[7px] shadow-[2px_2px_0_var(--ink)]">
        PALS ISLAND
      </div>
      {scenes.map((scene, index) => (
        <button
          type="button"
          key={scene.id}
          onClick={() => onEnter(scene)}
          className="absolute max-w-[118px] -translate-x-1/2 -translate-y-1/2 border-2 border-ink bg-card px-2 py-1 text-left shadow-[2px_2px_0_var(--ink)] transition-transform hover:scale-105"
          style={{ left: `${scene.outerX * 100}%`, top: `${scene.outerY * 100}%` }}
        >
          <span className={`mb-1 grid h-7 w-7 place-items-center border-2 border-ink ${palColors[index % palColors.length]?.bg ?? "bg-pink"} font-pixel text-[8px]`}>
            {index + 1}
          </span>
          <span className="block font-pixel text-[6px] leading-3 text-ink">{scene.shortName}</span>
          {!compact && <span className="mt-1 block font-mono-pixel text-xs leading-3 text-ink/70">ENTER</span>}
        </button>
      ))}
      <div className="absolute bottom-2 left-2 right-14 border-2 border-ink bg-mint px-2 py-1 font-mono-pixel text-sm leading-4 shadow-[2px_2px_0_var(--ink)]">
        点击岛上的入口，进入真实场景查看居民动效。
      </div>
    </div>
  );
}

export default function HomeWorld({ resident }: { resident?: ScreenResident | null | undefined }) {
  const [scenes, setScenes] = useState<ProductScene[]>(fallbackProductScenes);
  const [backendResidents, setBackendResidents] = useState<ProductResident[]>([]);
  const [activeScene, setActiveScene] = useState<ProductScene | null>(null);
  const [selectedId, setSelectedId] = useState(resident?.id ?? "local-preview");
  const [landscape, setLandscape] = useState(false);
  const [backendNotice, setBackendNotice] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    async function loadWorld() {
      try {
        const [loadedScenes, loadedResidents] = await Promise.all([
          listProductScenes(),
          listProductResidents(),
        ]);
        if (disposed) return;
        setScenes(loadedScenes.length ? loadedScenes : fallbackProductScenes);
        setBackendResidents(loadedResidents);
        setBackendNotice(null);
      } catch {
        if (disposed) return;
        setScenes(fallbackProductScenes);
        setBackendNotice("LOCAL SCENE CACHE");
      }
    }
    void loadWorld();
    return () => {
      disposed = true;
    };
  }, []);

  const residents = useMemo(() => mergeResidents(resident, backendResidents), [backendResidents, resident]);
  const currentSceneId = activeScene?.id;
  const sceneResidents = useMemo(() => {
    if (!currentSceneId) return residents;
    const inScene = backendResidents
      .filter((item) => item.activeSceneId === currentSceneId)
      .map((item) => toScreenResident(item));
    const merged = mergeResidents(resident, inScene as ProductResident[]);
    return merged.length ? merged : residents;
  }, [backendResidents, currentSceneId, resident, residents]);
  const visibleResidents = activeScene ? sceneResidents : residents;
  const pals = useMemo(() => {
    const source = visibleResidents.length ? visibleResidents : resident ? [resident] : [];
    const list = source.map((item, index) => palFromResident(item, index + sceneSlot(currentSceneId ?? ""), currentSceneId));
    return list.length ? list : [fallbackPal()];
  }, [currentSceneId, resident, visibleResidents]);
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

  const sceneTitle = activeScene ? activeScene.name : "PALS ISLAND";

  return (
    <section className="space-y-3 px-3 py-4">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-pixel text-[10px]">POCKET FRIEND</h1>
          <p className="truncate font-mono-pixel text-sm text-ink/70">
            {activeScene ? `${activeScene.shortName} · ${pals.length} RESIDENTS` : "PALS · 选择真实场景"}
          </p>
        </div>
        <div className="flex gap-1">
          {activeScene && (
            <button type="button" aria-label="返回小岛总览" onClick={() => setActiveScene(null)} className="pixel-icon-button bg-card">
              <ArrowLeft size={16} />
            </button>
          )}
          <button type="button" aria-label="刷新居民数据" onClick={() => window.location.reload()} className="pixel-icon-button bg-card">
            <RefreshCw size={15} />
          </button>
          <button type="button" aria-label="横屏查看小岛" onClick={() => setLandscape(true)} className="pixel-icon-button bg-card">
            <Maximize2 size={16} />
          </button>
        </div>
      </header>

      <div className="pixel-border-sm relative h-[285px] overflow-hidden bg-ink">
        {activeScene && activeSceneConfig ? (
          <InteractiveIsland sceneConfig={activeSceneConfig} pals={pals} selectedId={selected.id} onSelect={setSelectedId} compact />
        ) : (
          <OuterIsland scenes={scenes} onEnter={enterScene} compact />
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
              {selected.realPhotoUrl ? <img src={selected.realPhotoUrl} alt={`${selected.name} 真人照片`} className="h-full w-full object-cover" /> : "REF"}
            </div>
            <div className={`grid h-12 w-12 place-items-center overflow-hidden border-[3px] border-ink ${selectedColor.bg} font-pixel text-[10px]`}>
              {selected.spriteUrl ? <img src={selected.spriteUrl} alt={`${selected.name} 像素小人`} className="h-full w-full object-contain pixel-image" /> : selected.label}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-pixel text-[10px]">{selected.name}</h2>
            <p className="truncate font-mono-pixel text-sm text-ink/70">{selected.tags.slice(0, 3).join(" · ")}</p>
            <p className="mt-1 font-pixel text-[6px] text-ink/55">{sceneTitle}</p>
          </div>
          <Heart size={22} fill="var(--pink)" color="var(--ink)" aria-hidden="true" />
        </div>
        <p className="mt-3 border-2 border-ink bg-mint p-2 font-mono-pixel text-sm leading-5">{selected.bio}</p>
        <p className="mt-2 font-pixel text-[7px] text-ink/60">MET AT · {selected.metAt}</p>
        {backendNotice && <p className="mt-2 font-pixel text-[6px] text-ink/50">{backendNotice}</p>}
      </PixelCard>

      <div>
        <PixelLabel>{activeScene ? "SCENE RESIDENTS" : "SCENE ENTRANCES"}</PixelLabel>
        <div className="mt-2 space-y-2">
          {activeScene ? (
            pals.map((pal, index) => {
              const color = palColors[index % palColors.length] ?? palColors[0];
              return (
                <button type="button" key={pal.id} onClick={() => setSelectedId(pal.id)} className={`pixel-setting-row ${selected.id === pal.id ? "bg-pink" : "bg-card"}`}>
                  <span className={`grid h-8 w-8 place-items-center overflow-hidden border-2 border-ink ${color.bg} font-pixel text-[7px]`}>
                    {pal.spriteUrl ? <img src={pal.spriteUrl} alt="" className="h-full w-full object-contain pixel-image" /> : pal.label}
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
              <InteractiveIsland sceneConfig={activeSceneConfig} pals={pals} selectedId={selected.id} onSelect={setSelectedId} />
            ) : (
              <OuterIsland scenes={scenes} onEnter={enterScene} />
            )}
            <div className="absolute left-3 top-3 border-2 border-ink bg-lime px-3 py-2 font-pixel text-[8px] text-ink shadow-[2px_2px_0_var(--ink)]">
              {activeScene ? activeScene.shortName : "PALS ISLAND"}
            </div>
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
