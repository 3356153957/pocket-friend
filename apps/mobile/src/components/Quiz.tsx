import { ArrowRight, Check } from "lucide-react";

import {
  canContinueQuiz,
  toggleInterest,
  type Prefs,
} from "../app/appFlow.ts";

interface QuizProps {
  prefs: Prefs;
  setPrefs: (prefs: Prefs) => void;
  onNext: () => void;
}

const vibes = [
  { key: "quiet", label: "安静观察者", detail: "喜欢自己一个人，被懂的人找到就好" },
  { key: "spark", label: "话痨点火机", detail: "见谁都能聊十分钟，能量拉满" },
  { key: "curious", label: "好奇选手", detail: "对世界有点野，什么都想试" },
  { key: "chill", label: "松弛派", detail: "不勉强、不追赶，看缘分" },
];

const interests = [
  "深夜 livehouse", "冷门电影", "citywalk", "宠物友好",
  "咖啡拉花", "陶艺 / 手作", "独立书店", "户外露营",
  "桌游 / 剧本杀", "电子音乐", "写字 / 涂鸦", "运动搭子",
];

const meetStyles = [
  { key: "eye", label: "眼神一对上就走过来" },
  { key: "chat", label: "先聊几句再见面" },
  { key: "activity", label: "约着一起做点事" },
];

export default function Quiz({ prefs, setPrefs, onNext }: QuizProps) {
  return (
    <section className="mt-8 grid gap-8 md:grid-cols-[1.2fr_1fr]">
      <div>
        <div className="kicker">01 · 先让 AI 认识你一点点</div>
        <h2 className="section-title">你在人群里，<br />是哪一种<em>磁场</em>？</h2>

        <div className="mt-8 space-y-8">
          <fieldset>
            <legend className="field-label">选一个最像你的状态</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {vibes.map((vibe) => {
                const active = prefs.vibe === vibe.key;
                return (
                  <button
                    type="button"
                    key={vibe.key}
                    aria-pressed={active}
                    onClick={() => setPrefs({ ...prefs, vibe: vibe.key })}
                    className={`interactive min-h-[92px] rounded-2xl border p-4 text-left ${active ? "border-teal-deep bg-teal-deep text-white shadow-lg" : "border-border bg-card hover:border-teal-deep/40"}`}
                  >
                    <span className="block font-serif-display text-xl">{vibe.label}</span>
                    <span className={`mt-1 block text-xs ${active ? "text-white/75" : "text-muted-foreground"}`}>{vibe.detail}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="field-label">选 3 个以上你会一直聊的话题 <span className="text-xs text-muted-foreground">已选 {prefs.interests.length}</span></legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {interests.map((interest) => {
                const active = prefs.interests.includes(interest);
                return (
                  <button
                    type="button"
                    key={interest}
                    aria-pressed={active}
                    onClick={() => setPrefs({ ...prefs, interests: toggleInterest(prefs.interests, interest) })}
                    className={`interactive inline-flex min-h-11 items-center gap-1 rounded-full border px-4 py-2 text-sm ${active ? "border-coral bg-coral text-white" : "border-border bg-card text-teal-deep hover:border-coral/40"}`}
                  >
                    {active && <Check size={15} />} {interest}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="field-label">你希望怎么开始一次相遇？</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {meetStyles.map((style) => {
                const active = prefs.meetStyle === style.key;
                return (
                  <button
                    type="button"
                    key={style.key}
                    aria-pressed={active}
                    onClick={() => setPrefs({ ...prefs, meetStyle: style.key })}
                    className={`interactive min-h-[72px] rounded-2xl border p-4 text-sm ${active ? "border-teal-deep bg-secondary text-teal-deep" : "border-border bg-card text-muted-foreground"}`}
                  >
                    {style.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex justify-end">
            <button type="button" disabled={!canContinueQuiz(prefs)} onClick={onNext} className="interactive command-button bg-teal-deep text-white disabled:cursor-not-allowed disabled:opacity-40">
              下一步：设置我的挂坠 <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </div>

      <aside className="hidden md:block">
        <div className="sticky top-6 rounded-3xl border border-border bg-card p-6">
          <div className="text-xs text-muted-foreground">实时 AI 画像</div>
          <div className="mt-3 font-serif-display text-3xl text-teal-deep">{vibes.find((vibe) => vibe.key === prefs.vibe)?.label ?? "还在感受你…"}</div>
          <p className="mt-2 text-sm text-muted-foreground">AI 会用你的答案匹配磁场相近的人，而不是只比较条件。</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {prefs.interests.slice(0, 6).map((interest) => <span key={interest} className="rounded-full bg-secondary px-3 py-1 text-xs text-teal-deep">#{interest}</span>)}
          </div>
        </div>
      </aside>
    </section>
  );
}
