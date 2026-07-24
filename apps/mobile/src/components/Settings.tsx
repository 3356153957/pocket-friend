import { Bell, Bluetooth, LockKeyhole, UserRound, type LucideIcon } from "lucide-react";

import type { Prefs } from "../app/appFlow.ts";
import { AppLogo, PixelCard, PixelLabel } from "./PixelUi.tsx";

const buzzOptions = [
  { key: "gentle", label: "轻轻敲门" },
  { key: "spark", label: "心跳加速" },
  { key: "wave", label: "一阵小浪" },
  { key: "secret", label: "暗号模式" },
];

export default function Settings({ prefs, setPrefs }: {
  prefs: Prefs;
  setPrefs: (prefs: Prefs) => void;
}) {
  return (
    <div className="space-y-4 px-3 py-4">
      <div className="flex items-center gap-2">
        <AppLogo size={34} />
        <div>
          <h1 className="font-pixel text-[10px] text-ink">SETTINGS</h1>
          <p className="font-mono-pixel text-sm text-ink/70">挂坠 · 偏好 · 隐私</p>
        </div>
      </div>

      <PixelCard color="mint">
        <div className="flex items-center gap-3">
          <Bluetooth size={28} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="font-pixel text-[9px] text-ink">PENDANT · DEMO</div>
            <div className="font-mono-pixel text-sm text-ink/70">硬件连接将在 App 中启用</div>
          </div>
          <span className="pixel-border-sm bg-lime px-2 py-1 font-pixel text-[7px]">READY</span>
        </div>
      </PixelCard>

      <fieldset>
        <PixelLabel>震动方式</PixelLabel>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {buzzOptions.map((buzz) => {
            const active = prefs.buzz === buzz.key;
            return (
              <button
                type="button"
                key={buzz.key}
                aria-pressed={active}
                onClick={() => setPrefs({ ...prefs, buzz: buzz.key })}
                className={`pixel-option ${active ? "bg-cyan" : "bg-card"}`}
              >
                {active ? "[x] " : "[ ] "}{buzz.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <PixelLabel>感应半径 · {prefs.radius}m</PixelLabel>
        <input
          type="range"
          min={50}
          max={800}
          step={50}
          value={prefs.radius}
          onChange={(event) => setPrefs({ ...prefs, radius: Number(event.target.value) })}
          className="mt-2 h-11 w-full accent-[color:var(--pink)]"
        />
      </label>

      <label className="pixel-border-sm flex min-h-14 items-center gap-3 bg-card p-3">
        <input
          type="checkbox"
          checked={prefs.quiet}
          onChange={(event) => setPrefs({ ...prefs, quiet: event.target.checked })}
          className="h-5 w-5 accent-[color:var(--ink)]"
        />
        <span>
          <span className="block font-pixel text-[9px]">QUIET MODE</span>
          <span className="block font-mono-pixel text-sm text-ink/70">工作时段只记录，不震动</span>
        </span>
      </label>

      <div className="space-y-2">
        {([
          [UserRound, "个人资料"],
          [LockKeyhole, "隐私与匿名规则"],
          [Bell, "通知偏好"],
        ] as Array<[LucideIcon, string]>).map(([Icon, label]) => (
          <button type="button" key={label} className="pixel-setting-row">
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
            <span aria-hidden="true">&gt;</span>
          </button>
        ))}
      </div>
    </div>
  );
}
