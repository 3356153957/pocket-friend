import { LogIn, Play } from "lucide-react";

import { AppLogo, PixelButton, PixelCard } from "./PixelUi.tsx";

export default function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <section className="flex h-full flex-col items-center justify-between overflow-hidden bg-mint-screen px-5 py-7 text-center">
      <div className="font-pixel text-[8px] text-ink/60">SIGNAL FOUND · POCKET FRIEND</div>

      <div className="flex w-full flex-col items-center gap-5">
        <div className="relative grid aspect-square w-44 place-items-center overflow-hidden" aria-label="Pocket Friend 像素挂坠">
          <div className="absolute h-40 w-40 border-2 border-ink/20" />
          <div className="absolute h-28 w-28 border-2 border-pink animate-ping-slow" />
          <div className="pixel-border relative grid h-24 w-24 place-items-center bg-pink animate-float">
            <AppLogo size={72} />
          </div>
        </div>

        <div>
          <p className="font-pixel text-[9px] text-pink">MEET YOUR PEOPLE</p>
          <h1 className="mt-3 font-pixel text-[22px] leading-relaxed text-ink">POCKET<br />FRIEND</h1>
        </div>

        <PixelCard className="w-full" color="card">
          <p className="font-pixel text-[9px] leading-6 text-ink">AI 匹配 · 挂坠感应<br />让擦肩而过变成一次相遇</p>
        </PixelCard>

        <div className="grid w-full grid-cols-3 gap-2">
          {[["12K+", "RELAY"], ["63%", "HI RATE"], ["4.9", "STAR"]].map(([number, label]) => (
            <div key={label} className="pixel-border-sm bg-lime px-1 py-2">
              <div className="font-pixel text-[9px]">{number}</div>
              <div className="mt-1 font-pixel text-[6px] text-ink/60">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full space-y-3">
        <PixelButton onClick={onStart} variant="pink" fullWidth><Play size={16} fill="currentColor" /> START GAME</PixelButton>
        <button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 font-pixel text-[8px] text-ink/70 underline underline-offset-4">
          <LogIn size={15} /> 有账号 · 直接登录
        </button>
      </div>
    </section>
  );
}
