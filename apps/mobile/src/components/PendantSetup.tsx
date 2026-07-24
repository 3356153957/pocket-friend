import { ArrowLeft, ArrowRight, Vibrate } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Prefs } from "../app/appFlow.ts";

interface PendantSetupProps {
  prefs: Prefs;
  setPrefs: (prefs: Prefs) => void;
  onNext: () => void;
  onBack: () => void;
}

const buzzOptions = [
  { key: "gentle", label: "轻轻敲门", detail: "短短两下，不打扰" },
  { key: "spark", label: "心跳加速", detail: "由轻到重，像一次预告" },
  { key: "wave", label: "一阵小浪", detail: "柔和持续，适合散步" },
  { key: "secret", label: "暗号模式", detail: "长短组合，只有你知道" },
];

export default function PendantSetup({ prefs, setPrefs, onNext, onBack }: PendantSetupProps) {
  const [buzzing, setBuzzing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function tryBuzz() {
    if (timer.current) clearTimeout(timer.current);
    setBuzzing(true);
    timer.current = setTimeout(() => setBuzzing(false), 900);
  }

  return (
    <section className="mt-8 grid gap-10 md:grid-cols-[1fr_1.05fr]">
      <div>
        <div className="kicker">02 · 给你的挂坠一点脾气</div>
        <h2 className="section-title">它<em>怎么震</em>，<br />你就会怎么被找到</h2>
        <p className="mt-4 max-w-md text-sm text-muted-foreground">挂坠不会响、不会发通知。它只在你身边真的经过匹配对象时，用你选择的方式提醒你。</p>

        <div className="mt-8 space-y-8">
          <fieldset>
            <legend className="field-label">震动方式</legend>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {buzzOptions.map((buzz) => {
                const active = prefs.buzz === buzz.key;
                return (
                  <button
                    type="button"
                    key={buzz.key}
                    aria-pressed={active}
                    onClick={() => { setPrefs({ ...prefs, buzz: buzz.key }); tryBuzz(); }}
                    className={`interactive min-h-[88px] rounded-2xl border p-4 text-left ${active ? "border-coral bg-card shadow-lg" : "border-border bg-card hover:border-coral/40"}`}
                  >
                    <span className="block font-serif-display text-xl text-teal-deep">{buzz.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{buzz.detail}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="field-label">感应半径 <span className="text-xs text-muted-foreground">{prefs.radius} 米内触发</span></span>
            <input type="range" min={50} max={800} step={50} value={prefs.radius} onChange={(event) => setPrefs({ ...prefs, radius: Number(event.target.value) })} className="mt-4 h-11 w-full accent-[color:var(--coral)]" />
            <span className="flex justify-between text-[11px] text-muted-foreground"><span>擦肩而过</span><span>同一条街</span><span>同一个街区</span></span>
          </label>

          <label className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <input type="checkbox" checked={prefs.quiet} onChange={(event) => setPrefs({ ...prefs, quiet: event.target.checked })} className="h-5 w-5 accent-[color:var(--teal-deep)]" />
            <span><span className="block text-sm text-teal-deep">安静模式</span><span className="block text-xs text-muted-foreground">工作时段只记录，不震动</span></span>
          </label>

          <div className="flex flex-wrap justify-between gap-3">
            <button type="button" onClick={onBack} className="interactive command-button border border-border bg-card text-teal-deep"><ArrowLeft size={17} /> 上一步</button>
            <button type="button" onClick={onNext} disabled={!prefs.buzz} className="interactive command-button bg-teal-deep text-white disabled:opacity-40">开始寻找我的人 <ArrowRight size={17} /></button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-secondary p-6">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>挂坠预览</span>
          <button type="button" onClick={tryBuzz} className="interactive command-button bg-coral px-4 py-2 text-white"><Vibrate size={16} /> 试一下</button>
        </div>
        <div className="relative mx-auto mt-6 flex h-[360px] w-full items-center justify-center sm:h-[420px]">
          <div className="absolute h-56 w-56 rounded-full bg-coral/10" />
          <div className="relative">
            <div className="absolute -top-16 left-1/2 h-16 w-[3px] -translate-x-1/2 rounded-full bg-teal-deep" />
            <div className={`relative grid h-48 w-48 origin-top place-items-center rounded-full bg-teal-deep shadow-2xl sm:h-52 sm:w-52 ${buzzing ? "animate-buzz" : ""}`}>
              <div className="grid h-36 w-36 place-items-center rounded-full border border-white/20 bg-coral sm:h-40 sm:w-40">
                <div className="grid h-20 w-20 place-items-center rounded-full bg-background font-serif-display text-2xl text-teal-deep">PF</div>
              </div>
              <div className="absolute -right-2 top-8 h-4 w-4 rounded-full bg-amber" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-card/80 p-4 text-xs text-muted-foreground"><span className="text-teal-deep">当前设置：</span>{buzzOptions.find((buzz) => buzz.key === prefs.buzz)?.label ?? "还没选震动方式"} · {prefs.radius} m · {prefs.quiet ? "安静模式开" : "全天感应"}</div>
      </div>
    </section>
  );
}
