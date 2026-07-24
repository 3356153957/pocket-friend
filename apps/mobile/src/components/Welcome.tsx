import { ArrowRight, CircleHelp } from "lucide-react";

interface WelcomeProps {
  onStart: () => void;
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className="font-serif-display text-2xl text-teal-deep">{number}</div>
      <div>{label}</div>
    </div>
  );
}

function PendantHero() {
  return (
    <div className="relative mx-auto aspect-square overflow-hidden w-full max-w-[460px]" aria-label="Pocket Friend 感应挂坠">
      <div className="absolute inset-0 grid place-items-center">
        <div className="absolute h-[70%] w-[70%] rounded-full border border-teal-deep/20" />
        <div className="absolute h-[85%] w-[85%] rounded-full border border-teal-deep/10" />
        <div className="absolute h-[55%] w-[55%] rounded-full bg-coral/20 animate-ping-slow" />
        <div className="relative animate-float">
          <div className="absolute -top-10 left-1/2 h-10 w-[3px] -translate-x-1/2 rounded-full bg-teal-deep" />
          <div className="relative grid h-40 w-40 place-items-center rounded-full bg-teal-deep shadow-2xl shadow-teal-deep/30 sm:h-44 sm:w-44">
            <div className="grid h-28 w-28 place-items-center rounded-full border border-white/20 bg-coral sm:h-32 sm:w-32">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-background">
                <span className="font-serif-display text-2xl text-teal-deep">PF</span>
              </div>
            </div>
            <div className="absolute -right-2 top-6 h-3 w-3 rounded-full bg-amber shadow-md" />
          </div>
        </div>
      </div>
      <span className="floating-chip left-0 top-8">loud house</span>
      <span className="floating-chip right-0 top-24">读书胃口相同</span>
      <span className="floating-chip bottom-6 left-4">都爱一个人散步</span>
    </div>
  );
}

export default function Welcome({ onStart }: WelcomeProps) {
  return (
    <section className="mt-8 grid gap-8 md:mt-14 md:grid-cols-[1.05fr_1fr] md:items-center">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-coral" />
          AI 匹配 · 硬件感应 · 线下先见面
        </div>
        <h1 className="mt-6 font-serif-display text-5xl leading-[1.02] text-teal-deep sm:text-6xl lg:text-[84px]">
          让擦肩而过<br />
          <em className="text-coral">变成一次相遇</em>
        </h1>
        <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
          戴上 Pocket Friend 挂坠，走在街上、地铁里、咖啡馆。当你路过一个 AI 认为「你会喜欢」的人，挂坠会
          <span className="font-medium text-coral">轻轻震动</span>。先感觉到，再决定要不要打招呼。
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={onStart} className="interactive command-button bg-teal-deep text-white hover:bg-teal">
            开始设置我的偏好 <ArrowRight size={17} />
          </button>
          <button type="button" className="interactive command-button border border-border bg-card text-teal-deep hover:bg-secondary">
            <CircleHelp size={17} /> 这是什么？
          </button>
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
          <Stat number="12,438" label="正在附近发生的相遇" />
          <div className="hidden h-8 w-px bg-border sm:block" />
          <Stat number="63%" label="首次震动后主动说了「嗨」" />
        </div>
      </div>
      <PendantHero />
    </section>
  );
}
