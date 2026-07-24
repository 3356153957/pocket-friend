import { Heart, Moon, Sun, Sunset } from "lucide-react";
import { useState } from "react";

import { PixelCard, PixelLabel, pixelColorClass } from "./PixelUi.tsx";

const residents = [
  { id: "youyou", name: "呦呦", avatar: "狐", color: "pink", role: "咖啡师 · 会写诗", bio: "在巨鹿路开一家只有 6 个座位的店。", metAt: "巨鹿路 · 上周三", x: 22, y: 42 },
  { id: "k", name: "K", avatar: "K", color: "cyan", role: "自由插画师", bio: "养了一只橘猫叫土豆，画画时它趴在稿子上。", metAt: "长乐路 · 昨天", x: 68, y: 48 },
  { id: "xiaoman", name: "小满", avatar: "芽", color: "lime", role: "植物学博士生", bio: "阳台上养 27 盆植物，能说清它们的脾气。", metAt: "富民路 · 今早", x: 47, y: 72 },
] as const;

export default function HomeWorld() {
  const [selectedId, setSelectedId] = useState<string>(residents[0].id);
  const [time, setTime] = useState<"day" | "dusk" | "night">("day");
  const selected = residents.find((resident) => resident.id === selectedId)!;
  const sky = time === "day" ? "bg-cyan" : time === "dusk" ? "bg-pink" : "bg-ink";

  return (
    <section className="space-y-3 px-3 py-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-pixel text-[10px]">POCKET FRIEND</h1>
          <p className="font-mono-pixel text-sm text-ink/70">PALS · 我真正遇见过的人</p>
        </div>
        <div className="flex gap-1">
          {([["day", Sun, "白天"], ["dusk", Sunset, "黄昏"], ["night", Moon, "夜晚"]] as const).map(([key, Icon, label]) => (
            <button type="button" key={key} aria-label={label} aria-pressed={time === key} onClick={() => setTime(key)} className={`pixel-icon-button ${time === key ? "bg-lime" : "bg-card"}`}><Icon size={16} /></button>
          ))}
        </div>
      </header>

      <div className={`pixel-border-sm relative h-[285px] overflow-hidden ${sky} bg-scanlines`}>
        <div className="absolute right-5 top-5 h-7 w-7 border-2 border-ink bg-lime" />
        <div className="absolute inset-x-0 bottom-0 h-[58%] bg-lime bg-dotgrid">
          <div className="absolute bottom-4 left-5 h-16 w-20 border-[3px] border-ink bg-card">
            <div className="absolute -top-7 left-1/2 h-9 w-20 -translate-x-1/2 border-[3px] border-ink bg-pink [clip-path:polygon(50%_0,100%_100%,0_100%)]" />
            <div className="absolute bottom-0 right-3 h-8 w-5 border-2 border-ink bg-ink" />
          </div>
          {residents.map((resident) => (
            <button type="button" key={resident.id} aria-label={`查看 ${resident.name}`} aria-pressed={selectedId === resident.id} onClick={() => setSelectedId(resident.id)} className={`absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center border-[3px] border-ink ${pixelColorClass(resident.color)} font-pixel text-[10px] shadow-[3px_3px_0_var(--ink)]`} style={{ left: `${resident.x}%`, top: `${resident.y}%` }}>{resident.avatar}</button>
          ))}
        </div>
      </div>

      <PixelCard>
        <div className="flex items-center gap-3">
          <div className={`grid h-12 w-12 place-items-center border-[3px] border-ink ${pixelColorClass(selected.color)} font-pixel text-[10px]`}>{selected.avatar}</div>
          <div className="min-w-0 flex-1"><h2 className="font-pixel text-[10px]">{selected.name}</h2><p className="font-mono-pixel text-sm text-ink/70">{selected.role}</p></div>
          <Heart size={22} fill="var(--pink)" color="var(--ink)" aria-hidden="true" />
        </div>
        <p className="mt-3 border-2 border-ink bg-mint p-2 font-mono-pixel text-sm">{selected.bio}</p>
        <p className="mt-2 font-pixel text-[7px] text-ink/60">MET AT · {selected.metAt}</p>
      </PixelCard>

      <div>
        <PixelLabel>ALL PALS · {residents.length}</PixelLabel>
        <div className="mt-2 space-y-2">
          {residents.map((resident) => (
            <button type="button" key={resident.id} onClick={() => setSelectedId(resident.id)} className={`pixel-setting-row ${selectedId === resident.id ? "bg-pink" : "bg-card"}`}>
              <span className={`grid h-8 w-8 place-items-center border-2 border-ink ${pixelColorClass(resident.color)} font-pixel text-[7px]`}>{resident.avatar}</span>
              <span className="min-w-0 flex-1"><span className="block font-pixel text-[8px]">{resident.name}</span><span className="block truncate font-mono-pixel text-sm text-ink/70">{resident.role}</span></span>
              <span aria-hidden="true">&gt;</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
