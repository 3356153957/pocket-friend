import { Heart, Maximize2, Minimize2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import type { ScreenResident } from "../app/screenResident.ts";
import InteractiveIsland, { type IslandPal, type IslandSceneId } from "./InteractiveIsland.tsx";
import { PixelCard, PixelLabel, pixelColorClass } from "./PixelUi.tsx";

type DemoColor = "cyan" | "lime" | "pink";

const demoPals = [
  {
    id: "youyou",
    name: "呦呦",
    label: "狐",
    hair: "#f472b6",
    body: "#ec4899",
    tags: ["咖啡店", "书店", "陶艺"],
    bio: "在巨鹿路开一家只有 6 个座位的店。",
    metAt: "湖畔 · 上周三",
    rx: 0.28,
    ry: 0.58,
    color: "pink" as DemoColor,
  },
  {
    id: "k",
    name: "K",
    label: "K",
    hair: "#38bdf8",
    body: "#0ea5e9",
    tags: ["插画", "游戏", "像素"],
    bio: "喜欢把人画成会走路的小图标。",
    metAt: "湖畔 · 昨天",
    rx: 0.55,
    ry: 0.45,
    color: "cyan" as DemoColor,
  },
  {
    id: "xiaoman",
    name: "芽",
    label: "芽",
    hair: "#84cc16",
    body: "#a3e635",
    tags: ["植物", "散步", "观察"],
    bio: "阳台上养 27 盆植物，能说清它们的脾气。",
    metAt: "湖畔 · 今早",
    rx: 0.44,
    ry: 0.67,
    color: "lime" as DemoColor,
  },
  {
    id: "alex",
    name: "Alex",
    label: "A",
    hair: "#60a5fa",
    body: "#2563eb",
    tags: ["前端", "黑客松", "音乐"],
    bio: "Demo 前两小时还在修最后一个动效。",
    metAt: "Pocket Friend Hackathon",
    rx: 0.78,
    ry: 0.35,
    color: "cyan" as DemoColor,
  },
] as const;

function buildPals(resident?: ScreenResident | null): IslandPal[] {
  const userPal: IslandPal = {
    id: resident?.id ?? "luna",
    name: resident?.name ?? "Luna",
    label: "L",
    spriteUrl: resident?.pixelPortraitUrl,
    realPhotoUrl: resident?.portraitUrl,
    hair: "#c084fc",
    body: "#a855f7",
    tags: resident?.tags?.length ? resident.tags : ["入岛", "新朋友", "像素小人"],
    bio: resident
      ? `${resident.magnetType}，真人照片已识别，像素小人已入岛。`
      : "刚刚从掌机里跳上小岛。",
    metAt: "Pocket Friend · 刚刚",
    rx: 0.63,
    ry: 0.55,
  };

  return [
    userPal,
    ...demoPals.map((pal) => ({
      id: pal.id,
      name: pal.name,
      label: pal.label,
      hair: pal.hair,
      body: pal.body,
      tags: [...pal.tags],
      bio: pal.bio,
      metAt: pal.metAt,
      rx: pal.rx,
      ry: pal.ry,
    })),
  ];
}

function cardColor(id: string): DemoColor {
  return demoPals.find((pal) => pal.id === id)?.color ?? "pink";
}

export default function HomeWorld({ resident }: { resident?: ScreenResident | null | undefined }) {
  const pals = useMemo(() => buildPals(resident), [resident]);
  const [selectedId, setSelectedId] = useState(pals[0]?.id ?? "luna");
  const [scene, setScene] = useState<IslandSceneId>("hackathon");
  const [landscape, setLandscape] = useState(false);
  const selected = pals.find((pal) => pal.id === selectedId) ?? pals[0]!;
  const isResident = selected.id === resident?.id;

  return (
    <section className="space-y-3 px-3 py-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-pixel text-[10px]">POCKET FRIEND</h1>
          <p className="font-mono-pixel text-sm text-ink/70">PALS · 我真正遇见过的人</p>
        </div>
        <div className="flex gap-1">
          <button type="button" aria-label="切换主场景" onClick={() => setScene("hackathon")} className={`pixel-icon-button ${scene === "hackathon" ? "bg-lime" : "bg-card"}`}>
            <Sparkles size={16} />
          </button>
          <button type="button" aria-label="切换近景" onClick={() => setScene("alt")} className={`pixel-icon-button ${scene === "alt" ? "bg-lime" : "bg-card"}`}>
            <span className="font-pixel text-[9px]">2</span>
          </button>
          <button type="button" aria-label="横屏查看小岛" onClick={() => setLandscape(true)} className="pixel-icon-button bg-card">
            <Maximize2 size={16} />
          </button>
        </div>
      </header>

      <div className="pixel-border-sm relative h-[285px] overflow-hidden bg-ink">
        <InteractiveIsland scene={scene} pals={pals} selectedId={selectedId} onSelect={setSelectedId} compact />
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
            <div className={`grid h-12 w-12 place-items-center overflow-hidden border-[3px] border-ink ${pixelColorClass(cardColor(selected.id))} font-pixel text-[10px]`}>
              {selected.spriteUrl ? <img src={selected.spriteUrl} alt={`${selected.name} 像素小人`} className="h-full w-full object-contain pixel-image" /> : selected.label}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-pixel text-[10px]">{selected.name}</h2>
            <p className="truncate font-mono-pixel text-sm text-ink/70">{selected.tags.slice(0, 3).join(" · ")}</p>
            {isResident && (
              <p className="mt-1 font-pixel text-[6px] text-ink/55">
                {resident?.spriteSource === "seedream" ? "SEEDREAM SPRITE" : "LOCAL FALLBACK"}
              </p>
            )}
          </div>
          <Heart size={22} fill="var(--pink)" color="var(--ink)" aria-hidden="true" />
        </div>
        <p className="mt-3 border-2 border-ink bg-mint p-2 font-mono-pixel text-sm">{selected.bio}</p>
        <p className="mt-2 font-pixel text-[7px] text-ink/60">MET AT · {selected.metAt}</p>
      </PixelCard>

      <div>
        <PixelLabel>ALL PALS · {pals.length}</PixelLabel>
        <div className="mt-2 space-y-2">
          {pals.map((pal) => (
            <button type="button" key={pal.id} onClick={() => setSelectedId(pal.id)} className={`pixel-setting-row ${selectedId === pal.id ? "bg-pink" : "bg-card"}`}>
              <span className={`grid h-8 w-8 place-items-center overflow-hidden border-2 border-ink ${pixelColorClass(cardColor(pal.id))} font-pixel text-[7px]`}>
                {pal.spriteUrl ? <img src={pal.spriteUrl} alt="" className="h-full w-full object-contain pixel-image" /> : pal.label}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-pixel text-[8px]">{pal.name}</span>
                <span className="block truncate font-mono-pixel text-sm text-ink/70">{pal.tags.slice(0, 3).join(" · ")}</span>
              </span>
              <span aria-hidden="true">&gt;</span>
            </button>
          ))}
        </div>
      </div>

      {landscape && (
        <div className="fixed inset-0 z-50 bg-ink p-3">
          <div className="relative h-full overflow-hidden border-[3px] border-lime bg-ink shadow-[4px_4px_0_var(--lime)]">
            <InteractiveIsland scene={scene} pals={pals} selectedId={selectedId} onSelect={setSelectedId} />
            <div className="absolute left-3 top-3 border-2 border-ink bg-lime px-3 py-2 font-pixel text-[8px] text-ink shadow-[2px_2px_0_var(--ink)]">PALS ISLAND</div>
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
