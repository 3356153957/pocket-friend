import { LogIn, Play } from "lucide-react";
import { useState, type FormEvent } from "react";

import type { ProductProfileDraft } from "../app/productApi.ts";
import { AppLogo, PixelButton, PixelCard } from "./PixelUi.tsx";

export default function Welcome({ onStart }: {
  onStart: (profile: ProductProfileDraft) => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const canStart = name.trim().length > 0 && !saving;

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canStart) return;

    setSaving(true);
    try {
      await onStart({
        name: name.trim(),
        handle: name.trim(),
        role: role.trim(),
        bio: bio.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submitProfile} className="flex h-full flex-col items-center justify-between overflow-hidden bg-mint-screen px-5 py-7 text-center">
      <div className="font-pixel text-[8px] text-ink/60">SIGNAL FOUND · POCKET FRIEND</div>

      <div className="flex w-full flex-col items-center gap-4">
        <div className="relative grid aspect-square w-36 place-items-center overflow-hidden" aria-label="Pocket Friend pixel pendant">
          <div className="absolute h-32 w-32 border-2 border-ink/20" />
          <div className="absolute h-24 w-24 border-2 border-pink animate-ping-slow" />
          <div className="pixel-border relative grid h-20 w-20 place-items-center bg-pink animate-float">
            <AppLogo size={58} />
          </div>
        </div>

        <div>
          <p className="font-pixel text-[9px] text-pink">MEET YOUR PEOPLE</p>
          <h1 className="mt-2 font-pixel text-[19px] leading-relaxed text-ink">POCKET<br />FRIEND</h1>
        </div>

        <PixelCard className="w-full" color="card">
          <p className="font-pixel text-[8px] leading-5 text-ink">AI MATCH · HARDWARE SIGNAL<br />SAVE A REAL RESIDENT PROFILE</p>
        </PixelCard>

        <div className="w-full space-y-2 text-left">
          <label className="block">
            <span className="font-pixel text-[8px] text-ink">NAME</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full border-[3px] border-ink bg-card px-3 py-2 font-mono-pixel text-sm text-ink outline-none"
              placeholder="输入你的名字"
            />
          </label>
          <label className="block">
            <span className="font-pixel text-[8px] text-ink">ROLE</span>
            <input
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="mt-1 w-full border-[3px] border-ink bg-card px-3 py-2 font-mono-pixel text-sm text-ink outline-none"
              placeholder="硬件 / 软件 / 设计 / 观众"
            />
          </label>
          <label className="block">
            <span className="font-pixel text-[8px] text-ink">BIO</span>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              className="mt-1 min-h-14 w-full resize-none border-[3px] border-ink bg-card px-3 py-2 font-mono-pixel text-sm text-ink outline-none"
              placeholder="一句话介绍你"
            />
          </label>
        </div>
      </div>

      <div className="w-full space-y-3">
        <PixelButton type="submit" disabled={!canStart} variant="pink" fullWidth>
          <Play size={16} fill="currentColor" /> {saving ? "SAVING..." : "START GAME"}
        </PixelButton>
        <button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 font-pixel text-[8px] text-ink/70 underline underline-offset-4">
          <LogIn size={15} /> LOCAL BACKEND READY
        </button>
      </div>
    </form>
  );
}
