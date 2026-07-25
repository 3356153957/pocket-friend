import { LogIn, Play, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";

import type { ProductProfileDraft } from "../app/productApi.ts";
import { AppLogo, PixelButton, PixelCard } from "./PixelUi.tsx";

const demoLogin = {
  account: "demo",
  password: "pocket2026",
  name: "Demo Host",
  role: "Hackathon",
  bio: "Pocket Friend demo account",
};

export default function Welcome({
  onStart,
}: {
  onStart: (profile: ProductProfileDraft) => Promise<void> | void;
}) {
  const [account, setAccount] = useState(demoLogin.account);
  const [password, setPassword] = useState(demoLogin.password);
  const [name, setName] = useState(demoLogin.name);
  const [role, setRole] = useState(demoLogin.role);
  const [bio, setBio] = useState(demoLogin.bio);
  const [saving, setSaving] = useState(false);
  const canStart = account.trim().length > 0 && password.trim().length > 0 && name.trim().length > 0 && !saving;

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canStart) return;

    setSaving(true);
    try {
      await onStart({
        name: name.trim(),
        handle: account.trim(),
        role: role.trim(),
        bio: bio.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  function fillDemoLogin() {
    setAccount(demoLogin.account);
    setPassword(demoLogin.password);
    setName(demoLogin.name);
    setRole(demoLogin.role);
    setBio(demoLogin.bio);
  }

  return (
    <form onSubmit={submitProfile} className="flex h-full min-h-0 flex-col bg-mint-screen text-center">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 pb-4">
        <div className="font-pixel text-[8px] text-ink/60">SIGNAL FOUND · POCKET FRIEND</div>

        <div className="mt-4 flex w-full flex-col items-center gap-4">
          <div className="relative grid aspect-square w-28 place-items-center overflow-hidden" aria-label="Pocket Friend pixel pendant">
            <div className="absolute h-24 w-24 border-2 border-ink/20" />
            <div className="absolute h-20 w-20 border-2 border-pink animate-ping-slow" />
            <div className="pixel-border relative grid h-16 w-16 place-items-center bg-pink animate-float">
              <AppLogo size={46} />
            </div>
          </div>

          <div>
            <p className="font-pixel text-[9px] text-pink">MEET YOUR PEOPLE</p>
            <h1 className="mt-2 font-pixel text-[18px] leading-relaxed text-ink">POCKET<br />FRIEND</h1>
          </div>

          <PixelCard className="w-full" color="card">
            <div className="flex items-center justify-center gap-2">
              <UserRound size={17} />
              <p className="font-pixel text-[8px] leading-5 text-ink">DEMO ACCOUNT LOGIN</p>
            </div>
            <p className="mt-1 font-mono-pixel text-sm leading-4 text-ink/70">Profile saves to local product backend.</p>
          </PixelCard>

          <div className="w-full space-y-2 text-left">
            <label className="block">
              <span className="font-pixel text-[8px] text-ink">ACCOUNT</span>
              <input
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                className="mt-1 w-full border-[3px] border-ink bg-card px-3 py-2 font-mono-pixel text-sm text-ink outline-none"
                placeholder="demo"
                autoComplete="username"
              />
            </label>

            <label className="block">
              <span className="font-pixel text-[8px] text-ink">PASSWORD</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full border-[3px] border-ink bg-card px-3 py-2 font-mono-pixel text-sm text-ink outline-none"
                placeholder="pocket2026"
                type="password"
                autoComplete="current-password"
              />
            </label>

            <label className="block">
              <span className="font-pixel text-[8px] text-ink">NICKNAME</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full border-[3px] border-ink bg-card px-3 py-2 font-mono-pixel text-sm text-ink outline-none"
                placeholder="Your display name"
              />
            </label>

            <label className="block">
              <span className="font-pixel text-[8px] text-ink">ROLE</span>
              <input
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="mt-1 w-full border-[3px] border-ink bg-card px-3 py-2 font-mono-pixel text-sm text-ink outline-none"
                placeholder="Hardware / Software / Design"
              />
            </label>

            <label className="block">
              <span className="font-pixel text-[8px] text-ink">BIO</span>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                className="mt-1 min-h-14 w-full resize-none border-[3px] border-ink bg-card px-3 py-2 font-mono-pixel text-sm text-ink outline-none"
                placeholder="One sentence intro"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t-[3px] border-ink bg-mint px-5 py-3 shadow-[0_-3px_0_var(--ink)]">
        <PixelButton type="submit" disabled={!canStart} variant="pink" fullWidth>
          <Play size={16} fill="currentColor" /> {saving ? "SAVING..." : "START GAME"}
        </PixelButton>
        <button
          type="button"
          onClick={fillDemoLogin}
          className="mt-2 inline-flex min-h-9 items-center justify-center gap-2 font-pixel text-[8px] text-ink/70 underline underline-offset-4"
        >
          <LogIn size={15} /> USE DEMO ACCOUNT
        </button>
      </div>
    </form>
  );
}
