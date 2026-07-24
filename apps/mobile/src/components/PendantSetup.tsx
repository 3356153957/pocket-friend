import { ArrowLeft, ArrowRight, Vibrate } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Prefs } from "../app/appFlow.ts";
import { AppLogo, PixelButton, PixelLabel, StepPips } from "./PixelUi.tsx";

const buzzOptions = [
  { key: "gentle", label: "轻轻敲门" },
  { key: "spark", label: "心跳加速" },
  { key: "wave", label: "一阵小浪" },
  { key: "secret", label: "暗号模式" },
];

export default function PendantSetup({ prefs, setPrefs, onNext, onBack }: {
  prefs: Prefs;
  setPrefs: (prefs: Prefs) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [buzzing, setBuzzing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function tryBuzz() {
    if (timer.current) clearTimeout(timer.current);
    setBuzzing(true);
    timer.current = setTimeout(() => setBuzzing(false), 700);
  }

  return (
    <section className="space-y-5 px-4 py-5">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="pixel-back"><ArrowLeft size={15} /> BACK</button>
        <StepPips active={2} total={2} />
        <div className="w-14" />
      </div>

      <div>
        <div className="font-pixel text-[8px] text-pink">02 · PAIR PENDANT</div>
        <h1 className="mt-3 font-pixel text-[14px] leading-7">给挂坠一点 <span className="text-pink">脾气</span></h1>
      </div>

      <div className="pixel-border bg-mint-screen p-4">
        <div className="flex flex-col items-center gap-4">
          <div className={`pixel-border grid h-32 w-32 place-items-center bg-pink ${buzzing ? "animate-buzz" : ""}`}><AppLogo size={98} /></div>
          <PixelButton onClick={tryBuzz} variant="pink"><Vibrate size={16} /> TEST BUZZ</PixelButton>
        </div>
      </div>

      <fieldset>
        <PixelLabel>震动方式</PixelLabel>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {buzzOptions.map((buzz) => {
            const active = prefs.buzz === buzz.key;
            return <button type="button" key={buzz.key} aria-pressed={active} onClick={() => { setPrefs({ ...prefs, buzz: buzz.key }); tryBuzz(); }} className={`pixel-option ${active ? "bg-cyan" : "bg-card"}`}>{active ? "[x] " : "[ ] "}{buzz.label}</button>;
          })}
        </div>
      </fieldset>

      <label className="block">
        <PixelLabel>感应半径 · {prefs.radius}m</PixelLabel>
        <input type="range" min={50} max={800} step={50} value={prefs.radius} onChange={(event) => setPrefs({ ...prefs, radius: Number(event.target.value) })} className="mt-2 h-11 w-full accent-[color:var(--pink)]" />
      </label>

      <label className="pixel-border-sm flex min-h-14 items-center gap-3 bg-card p-3">
        <input type="checkbox" checked={prefs.quiet} onChange={(event) => setPrefs({ ...prefs, quiet: event.target.checked })} className="h-5 w-5 accent-[color:var(--ink)]" />
        <span><span className="block font-pixel text-[8px]">QUIET MODE</span><span className="font-mono-pixel text-sm text-ink/70">工作时段只记录，不震动</span></span>
      </label>

      <PixelButton onClick={onNext} disabled={!prefs.buzz} variant="pink" fullWidth>ENTER POCKET FRIEND <ArrowRight size={16} /></PixelButton>
    </section>
  );
}
