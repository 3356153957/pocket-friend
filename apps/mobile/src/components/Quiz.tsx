import { ArrowLeft, ArrowRight, SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import {
  archetypeOptions,
  buildAdjustedEncounterProfile,
  calculateEncounterProfile,
  deriveLegacyMatchingPrefs,
  firstMeetStyleOptions,
  isQuizComplete,
  privacyModeOptions,
  quizQuestions,
  type Archetype,
  type EncounterProfile,
  type FirstMeetStyle,
  type PrivacyMode,
  type QuizAnswers,
  type QuizQuestionId,
} from "../app/encounterProfile.ts";
import type { Prefs } from "../app/appFlow.ts";
import { PixelButton, PixelCard, PixelLabel, StepPips } from "./PixelUi.tsx";

export default function Quiz({ prefs, setPrefs, onNext, onBack }: {
  prefs: Prefs;
  setPrefs: (prefs: Prefs) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [answers, setAnswers] = useState<QuizAnswers>(prefs.quizAnswers);
  const [profile, setProfile] = useState<EncounterProfile | null>(prefs.encounterProfile ?? null);
  const [editing, setEditing] = useState(false);
  const [newTag, setNewTag] = useState("");

  const complete = isQuizComplete(answers);
  const answeredCount = useMemo(
    () => quizQuestions.filter((question) => Boolean(answers[question.id])).length,
    [answers],
  );

  function selectAnswer(questionId: QuizQuestionId, choice: "A" | "B" | "C" | "D") {
    const nextAnswers = { ...answers, [questionId]: choice };
    const { encounterProfile: _encounterProfile, ...restPrefs } = prefs;
    setAnswers(nextAnswers);
    setProfile(null);
    setPrefs({ ...restPrefs, quizAnswers: nextAnswers });
  }

  function generateProfile() {
    if (!isQuizComplete(answers)) return;
    const nextProfile = calculateEncounterProfile(answers);
    const legacyPrefs = deriveLegacyMatchingPrefs(nextProfile);
    setProfile(nextProfile);
    setPrefs({
      ...prefs,
      ...legacyPrefs,
      quizAnswers: answers,
      encounterProfile: nextProfile,
    });
  }

  function applyProfileUpdate(nextProfile: EncounterProfile) {
    const legacyPrefs = deriveLegacyMatchingPrefs(nextProfile);
    setProfile(nextProfile);
    setPrefs({
      ...prefs,
      ...legacyPrefs,
      quizAnswers: answers,
      encounterProfile: nextProfile,
    });
  }

  function updateArchetype(archetype: Archetype) {
    if (!profile) return;
    applyProfileUpdate(buildAdjustedEncounterProfile(profile, { archetype }));
  }

  function updateFirstMeetStyle(firstMeetStyle: FirstMeetStyle) {
    if (!profile) return;
    applyProfileUpdate(buildAdjustedEncounterProfile(profile, { firstMeetStyle }));
  }

  function updatePrivacyMode(privacyMode: PrivacyMode) {
    if (!profile) return;
    applyProfileUpdate(buildAdjustedEncounterProfile(profile, { privacyMode }));
  }

  function removeTag(tag: string) {
    if (!profile || profile.sceneTags.length <= 3) return;
    applyProfileUpdate(buildAdjustedEncounterProfile(profile, {
      sceneTags: profile.sceneTags.filter((candidate) => candidate !== tag),
    }));
  }

  function addTag() {
    if (!profile) return;
    const tag = newTag.trim();
    if (!tag || profile.sceneTags.includes(tag)) return;
    applyProfileUpdate(buildAdjustedEncounterProfile(profile, {
      sceneTags: [...profile.sceneTags, tag],
    }));
    setNewTag("");
  }

  if (profile) {
    return (
      <section className="space-y-5 px-4 py-5">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setProfile(null)} className="pixel-back"><ArrowLeft size={15} /> BACK</button>
          <StepPips active={1} total={2} />
          <button type="button" onClick={() => setEditing((current) => !current)} className="pixel-icon-button" aria-pressed={editing} aria-label="调整画像">
            <SlidersHorizontal size={16} />
          </button>
        </div>

        <div>
          <div className="font-pixel text-[8px] text-pink">01 · ENCOUNTER PROFILE</div>
          <h1 className="mt-3 font-pixel text-[14px] leading-7 text-ink">你的岛民<span className="text-pink">磁场</span></h1>
        </div>

        <PixelCard color="mint" className="space-y-3">
          <div>
            <div className="font-pixel text-[11px] leading-6 text-ink">{profile.archetype}</div>
            <p className="mt-2 font-mono-pixel text-sm leading-5 text-ink/75">{profile.displayText}</p>
          </div>
          <ProfileLine label="初遇方式" value={profile.firstMeetStyle} />
          <ProfileLine label="相遇偏好" value={profile.encounterPreference} />
          <ProfileLine label="捕捉边界" value={profile.privacyMode} />
          <div>
            <PixelLabel>推荐场景</PixelLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.sceneTags.map((tag) => (
                <button type="button" key={tag} onClick={() => editing && removeTag(tag)} className="pixel-tag bg-cyan" aria-label={editing ? `移除 ${tag}` : tag}>
                  #{tag}{editing && profile.sceneTags.length > 3 ? " x" : ""}
                </button>
              ))}
            </div>
          </div>
        </PixelCard>

        {editing && (
          <PixelCard color="card" className="space-y-4">
            <EditGroup label="岛民磁场">
              <div className="grid grid-cols-2 gap-2">
                {archetypeOptions.map((option) => (
                  <button type="button" key={option} onClick={() => updateArchetype(option)} className={`pixel-option ${profile.archetype === option ? "bg-pink" : "bg-card"}`}>{profile.archetype === option ? "[x] " : "[ ] "}{option}</button>
                ))}
              </div>
            </EditGroup>

            <EditGroup label="初遇方式">
              <div className="space-y-2">
                {firstMeetStyleOptions.map((option) => (
                  <button type="button" key={option} onClick={() => updateFirstMeetStyle(option)} className={`pixel-option w-full text-left ${profile.firstMeetStyle === option ? "bg-lime" : "bg-card"}`}>{profile.firstMeetStyle === option ? "[x] " : "[ ] "}{option}</button>
                ))}
              </div>
            </EditGroup>

            <EditGroup label="捕捉边界">
              <div className="space-y-2">
                {privacyModeOptions.map((option) => (
                  <button type="button" key={option} onClick={() => updatePrivacyMode(option)} className={`pixel-option w-full text-left ${profile.privacyMode === option ? "bg-cyan" : "bg-card"}`}>{profile.privacyMode === option ? "[x] " : "[ ] "}{option}</button>
                ))}
              </div>
            </EditGroup>

            <EditGroup label="新增场景标签">
              <div className="flex gap-2">
                <input
                  value={newTag}
                  onChange={(event) => setNewTag(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTag();
                    }
                  }}
                  className="min-w-0 flex-1 border-[3px] border-ink bg-card px-3 py-2 font-mono-pixel text-sm text-ink outline-none"
                  placeholder="输入标签"
                />
                <button type="button" onClick={addTag} className="pixel-button bg-lime px-3">ADD</button>
              </div>
            </EditGroup>

            <button type="button" onClick={() => setEditing(false)} className="pixel-back"><X size={15} /> 收起调整</button>
          </PixelCard>
        )}

        <PixelButton onClick={onNext} variant="pink" fullWidth>确认，设置挂坠 <ArrowRight size={16} /></PixelButton>
      </section>
    );
  }

  return (
    <section className="space-y-5 px-4 py-5">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="pixel-back"><ArrowLeft size={15} /> BACK</button>
        <StepPips active={1} total={2} />
        <div className="w-14" />
      </div>

      <div>
        <div className="font-pixel text-[8px] text-pink">01 · ABOUT YOU</div>
        <h1 className="mt-3 font-pixel text-[14px] leading-7 text-ink">遇见画像<span className="text-pink">问卷</span></h1>
      </div>

      {quizQuestions.map((question, index) => (
        <fieldset key={question.id} className="space-y-2">
          <PixelLabel>Q{index + 1} · {question.title}</PixelLabel>
          <div className="grid grid-cols-1 gap-2">
            {question.options.map((option) => {
              const active = answers[question.id] === option.key;
              return (
                <button
                  type="button"
                  key={option.key}
                  aria-pressed={active}
                  onClick={() => selectAnswer(question.id, option.key)}
                  className={`pixel-choice text-left ${active ? "bg-pink" : "bg-card"}`}
                >
                  <span className="font-pixel text-[8px]">{option.key}</span>
                  <span className="mt-2 block font-mono-pixel text-sm leading-5 text-ink/75">{option.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="pixel-border-sm bg-card p-3 font-mono-pixel text-sm text-ink/70">
        已回答 {answeredCount} / {quizQuestions.length}。系统会根据你的选择生成磁场、推荐场景和捕捉边界。
      </div>

      <PixelButton onClick={generateProfile} disabled={!complete} variant="pink" fullWidth>生成遇见画像 <ArrowRight size={16} /></PixelButton>
    </section>
  );
}

function ProfileLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="pixel-border-sm bg-card p-2">
      <span className="block font-pixel text-[7px] text-ink/60">{label}</span>
      <span className="mt-1 block font-mono-pixel text-sm text-ink">{value}</span>
    </div>
  );
}

function EditGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset>
      <PixelLabel>{label}</PixelLabel>
      <div className="mt-2">{children}</div>
    </fieldset>
  );
}
