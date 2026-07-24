import type { Step } from "../app/appFlow.ts";

interface TopBarProps {
  step: Step;
  onHome: () => void;
}

const steps: Array<{ key: Exclude<Step, "welcome">; label: string }> = [
  { key: "quiz", label: "偏好问卷" },
  { key: "pendant", label: "挂坠设置" },
  { key: "matching", label: "附近匹配" },
  { key: "home", label: "小家园" },
];

export function PendantLogo() {
  return (
    <span className="relative grid h-9 w-9 shrink-0 place-items-center" aria-hidden="true">
      <span className="absolute inset-0 rounded-full border-2 border-teal-deep" />
      <span className="h-4 w-4 rounded-full bg-coral" />
      <span className="absolute -top-1 left-1/2 h-2 w-0.5 -translate-x-1/2 bg-teal-deep" />
    </span>
  );
}

export default function TopBar({ step, onHome }: TopBarProps) {
  const activeIndex = steps.findIndex((candidate) => candidate.key === step);

  return (
    <header className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-4 pt-4 sm:px-6 sm:pt-6">
      <button
        type="button"
        onClick={onHome}
        className="interactive flex items-center gap-2 rounded-lg"
        aria-label="返回 Pocket Friend 欢迎页"
      >
        <PendantLogo />
        <span className="font-serif-display text-xl text-teal-deep sm:text-2xl">Pocket Friend</span>
      </button>

      {step !== "welcome" && (
        <ol className="hidden items-center gap-1 rounded-full border border-border bg-card/80 px-2 py-1.5 text-xs md:flex" aria-label="设置进度">
          {steps.map((item, index) => {
            const active = index === activeIndex;
            const done = index < activeIndex;
            return (
              <li
                key={item.key}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${active ? "bg-teal-deep text-white" : "text-muted-foreground"}`}
              >
                <span className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${done ? "bg-coral text-white" : active ? "bg-white/20" : "bg-muted"}`}>
                  {done ? "✓" : index + 1}
                </span>
                {item.label}
              </li>
            );
          })}
        </ol>
      )}

      <span className="hidden text-right text-xs text-muted-foreground sm:block">v0.1 · demo</span>
    </header>
  );
}
