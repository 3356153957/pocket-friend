import { ArrowLeft, ArrowRight } from "lucide-react";

import { canContinueQuiz, toggleInterest, type Prefs } from "../app/appFlow.ts";
import { PixelButton, PixelLabel, StepPips } from "./PixelUi.tsx";

const vibes = [
  { key: "quiet", label: "安静观察者", detail: "被懂的人找到就好" },
  { key: "spark", label: "话痨点火机", detail: "见谁都能聊十分钟" },
  { key: "curious", label: "好奇选手", detail: "什么都想试一试" },
  { key: "chill", label: "松弛派", detail: "不追赶，看缘分" },
];

const interests = [
  "深夜 livehouse", "冷门电影", "citywalk", "宠物友好",
  "咖啡拉花", "陶艺手作", "独立书店", "户外露营",
  "桌游剧本杀", "电子音乐", "写字涂鸦", "运动搭子",
];

const meetStyles = ["眼神对上，走过来", "先聊几句", "一起做点事"];

export default function Quiz({ prefs, setPrefs, onNext, onBack }: {
  prefs: Prefs;
  setPrefs: (prefs: Prefs) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <section className="space-y-5 px-4 py-5">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="pixel-back"><ArrowLeft size={15} /> BACK</button>
        <StepPips active={1} total={2} />
        <div className="w-14" />
      </div>

      <div>
        <div className="font-pixel text-[8px] text-pink">01 · ABOUT YOU</div>
        <h1 className="mt-3 font-pixel text-[14px] leading-7 text-ink">你是哪一种 <span className="text-pink">磁场</span>？</h1>
      </div>

      <fieldset>
        <PixelLabel>选一个最像你的状态</PixelLabel>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {vibes.map((vibe) => {
            const active = prefs.vibe === vibe.key;
            return (
              <button type="button" key={vibe.key} aria-pressed={active} onClick={() => setPrefs({ ...prefs, vibe: vibe.key })} className={`pixel-choice ${active ? "bg-pink" : "bg-card"}`}>
                <span className="font-pixel text-[8px]">{vibe.label}</span>
                <span className="mt-2 block font-mono-pixel text-sm text-ink/70">{vibe.detail}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <PixelLabel>兴趣 · 至少选 3 个 ({prefs.interests.length})</PixelLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {interests.map((interest) => {
            const active = prefs.interests.includes(interest);
            return (
              <button type="button" key={interest} aria-pressed={active} onClick={() => setPrefs({ ...prefs, interests: toggleInterest(prefs.interests, interest) })} className={`pixel-tag ${active ? "bg-cyan" : "bg-card"}`}>
                {active ? "[x] " : ""}{interest}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <PixelLabel>怎么开始一次相遇</PixelLabel>
        <div className="mt-2 space-y-2">
          {meetStyles.map((label, index) => {
            const key = ["eye", "chat", "activity"][index]!;
            const active = prefs.meetStyle === key;
            return <button type="button" key={key} aria-pressed={active} onClick={() => setPrefs({ ...prefs, meetStyle: key })} className={`pixel-option w-full text-left ${active ? "bg-lime" : "bg-card"}`}>{active ? "[x] " : "[ ] "}{label}</button>;
          })}
        </div>
      </fieldset>

      <PixelButton onClick={onNext} disabled={!canContinueQuiz(prefs)} variant="pink" fullWidth>NEXT · 设置挂坠 <ArrowRight size={16} /></PixelButton>
    </section>
  );
}
