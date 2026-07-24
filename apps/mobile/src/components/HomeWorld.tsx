import { ArrowLeft, Moon, Sun, Sunset } from "lucide-react";
import { useMemo, useState } from "react";

interface HomeWorldProps {
  onBack: () => void;
}

type TimeMode = "day" | "dusk" | "night";

const residents = [
  { id: "youyou", name: "呦呦", avatar: "狐", role: "咖啡师 / 会写诗", bio: "在巨鹿路开一家只有 6 个座位的店，喜欢把客人的话写进小卡片。", metAt: "巨鹿路 · 上周三 19:12", tags: ["独立书店", "深夜写字"], x: "22%", y: "40%" },
  { id: "k", name: "K", avatar: "K", role: "自由插画师", bio: "养了一只叫土豆的橘猫，画画的时候它就趴在稿子上。", metAt: "长乐路 · 昨天 12:04", tags: ["宠物友好", "陶艺"], x: "68%", y: "46%" },
  { id: "xiaoman", name: "小满", avatar: "芽", role: "植物学博士生", bio: "阳台上养着 27 盆植物，能一口气讲清楚它们各自的脾气。", metAt: "富民路 · 今早 08:41", tags: ["citywalk", "手作"], x: "46%", y: "70%" },
];

export default function HomeWorld({ onBack }: HomeWorldProps) {
  const [selectedId, setSelectedId] = useState(residents[0]!.id);
  const [time, setTime] = useState<TimeMode>("day");
  const selected = residents.find((resident) => resident.id === selectedId)!;
  const skyClass = useMemo(() => ({ day: "home-day", dusk: "home-dusk", night: "home-night" })[time], [time]);

  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-lg">
        <div className={`relative h-[520px] w-full ${skyClass}`}>
          <div className="absolute inset-x-0 bottom-0 h-[62%] bg-teal/15" />
          <div className="absolute bottom-[17%] left-[39%] h-20 w-40 rounded-[50%] bg-teal/35 shadow-inner" />
          <div className="absolute left-[9%] top-[38%] h-28 w-36 rounded-t-[52px] border-4 border-white/60 bg-coral/60 shadow-xl"><div className="mx-auto mt-12 h-16 w-10 rounded-t-full bg-teal-deep/80" /></div>
          {residents.map((resident) => (
            <button
              type="button"
              key={resident.id}
              aria-pressed={resident.id === selectedId}
              onClick={() => setSelectedId(resident.id)}
              className={`interactive absolute grid h-12 w-12 place-items-center rounded-full border-2 border-white bg-coral text-sm font-semibold text-white shadow-lg ${resident.id === selectedId ? "ring-4 ring-amber" : ""}`}
              style={{ left: resident.x, top: resident.y }}
              aria-label={`查看居民 ${resident.name}`}
            >
              {resident.avatar}
            </button>
          ))}
          <div className="absolute left-4 top-4 flex gap-1 rounded-full bg-card/90 p-1 shadow-sm">
            {([
              ["day", Sun, "白天"],
              ["dusk", Sunset, "黄昏"],
              ["night", Moon, "夜晚"],
            ] as const).map(([mode, Icon, label]) => (
              <button type="button" key={mode} onClick={() => setTime(mode)} className={`interactive grid h-11 w-11 place-items-center rounded-full ${time === mode ? "bg-teal-deep text-white" : "text-teal-deep"}`} aria-label={label} aria-pressed={time === mode}><Icon size={18} /></button>
            ))}
          </div>
          <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-card/90 p-4 backdrop-blur">
            <div className="text-xs text-muted-foreground">Pocket Friend 小家园</div>
            <div className="font-serif-display text-xl text-teal-deep">这里住着你真正遇见过的人</div>
          </div>
        </div>
      </div>

      <aside className="rounded-3xl border border-border bg-card p-5">
        <button type="button" onClick={onBack} className="interactive command-button border border-border px-4 py-2 text-teal-deep"><ArrowLeft size={16} /> 返回地图</button>
        <div className="mt-6 flex items-center gap-3">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-coral text-lg font-semibold text-white">{selected.avatar}</div>
          <div><h2 className="font-serif-display text-3xl text-teal-deep">{selected.name}</h2><p className="text-xs text-muted-foreground">{selected.role}</p></div>
        </div>
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{selected.bio}</p>
        <div className="mt-4 rounded-2xl bg-secondary p-3 text-xs text-muted-foreground">初次相遇：{selected.metAt}</div>
        <div className="mt-4 flex flex-wrap gap-2">{selected.tags.map((tag) => <span key={tag} className="rounded-full bg-teal-deep px-3 py-1 text-xs text-white">#{tag}</span>)}</div>
        <button type="button" className="interactive command-button mt-6 w-full justify-center bg-coral text-white">发条消息</button>
      </aside>
    </section>
  );
}
