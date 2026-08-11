import { LogIn, Play, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";

import { DEMO_LOGIN } from "../app/demoCredentials.ts";
import type { ProductProfileDraft } from "../app/productApi.ts";
import { PUBLIC_DEMO_MODE } from "../app/publicDemoRuntime.ts";
import { AppLogo, PixelButton, PixelCard } from "./PixelUi.tsx";

export default function Welcome({
  onStart,
}: {
  onStart: (profile: ProductProfileDraft) => Promise<void> | void;
}) {
  const [account, setAccount] = useState(DEMO_LOGIN.account);
  const [password, setPassword] = useState(DEMO_LOGIN.password);
  const [name, setName] = useState(DEMO_LOGIN.name);
  const [role, setRole] = useState(DEMO_LOGIN.role);
  const [bio, setBio] = useState(DEMO_LOGIN.bio);
  const [saving, setSaving] = useState(false);
  const canStart = account.trim().length > 0
    && (PUBLIC_DEMO_MODE || password.trim().length > 0)
    && name.trim().length > 0
    && !saving;

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
    setAccount(DEMO_LOGIN.account);
    setPassword(DEMO_LOGIN.password);
    setName(DEMO_LOGIN.name);
    setRole(DEMO_LOGIN.role);
    setBio(DEMO_LOGIN.bio);
  }

  return (
    <form onSubmit={submitProfile} className="flex h-full min-h-0 flex-col bg-mint-screen text-center">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 pb-4">
        <div className="font-pixel text-[8px] text-ink/60">已发现信号 · 口袋朋友</div>

        <div className="mt-4 flex w-full flex-col items-center gap-4">
          <div className="relative grid aspect-square w-28 place-items-center overflow-hidden" aria-label="口袋朋友像素挂坠">
            <div className="absolute h-24 w-24 border-2 border-ink/20" />
            <div className="absolute h-20 w-20 border-2 border-pink animate-ping-slow" />
            <div className="pixel-border relative grid h-16 w-16 place-items-center bg-pink animate-float">
              <AppLogo size={46} />
            </div>
          </div>

          <div>
            <p className="font-pixel text-[9px] text-pink">遇见同频的人</p>
            <h1 className="mt-2 font-pixel text-[18px] leading-relaxed text-ink">口袋<br />朋友</h1>
          </div>

          <PixelCard className="w-full" color="card">
            <div className="flex items-center justify-center gap-2">
              <UserRound size={17} />
              <p className="font-pixel text-[8px] leading-5 text-ink">
                {PUBLIC_DEMO_MODE ? "公开脱敏演示" : "演示账号登录"}
              </p>
            </div>
            <p className="mt-1 font-mono-pixel text-sm leading-4 text-ink/70">
              {PUBLIC_DEMO_MODE ? "资料仅保留在当前页面，不会上传。" : "资料会保存到产品服务中。"}
            </p>
          </PixelCard>

          <div className="w-full space-y-2 text-left">
            <label className="block">
              <span className="font-pixel text-[8px] text-ink">账号</span>
              <input
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                className="mt-1 w-full border-[3px] border-ink bg-card px-3 py-2 font-mono-pixel text-sm text-ink outline-none"
                placeholder="演示账号"
                autoComplete="username"
              />
            </label>

            {!PUBLIC_DEMO_MODE && (
              <label className="block">
                <span className="font-pixel text-[8px] text-ink">密码</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1 w-full border-[3px] border-ink bg-card px-3 py-2 font-mono-pixel text-sm text-ink outline-none"
                  placeholder="请输入演示密码"
                  type="password"
                  autoComplete="current-password"
                />
              </label>
            )}

            <label className="block">
              <span className="font-pixel text-[8px] text-ink">昵称</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full border-[3px] border-ink bg-card px-3 py-2 font-mono-pixel text-sm text-ink outline-none"
                placeholder="你的显示名称"
              />
            </label>

            <label className="block">
              <span className="font-pixel text-[8px] text-ink">身份</span>
              <input
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="mt-1 w-full border-[3px] border-ink bg-card px-3 py-2 font-mono-pixel text-sm text-ink outline-none"
                placeholder="硬件 / 软件 / 设计"
              />
            </label>

            <label className="block">
              <span className="font-pixel text-[8px] text-ink">简介</span>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                className="mt-1 min-h-14 w-full resize-none border-[3px] border-ink bg-card px-3 py-2 font-mono-pixel text-sm text-ink outline-none"
                placeholder="用一句话介绍自己"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t-[3px] border-ink bg-mint px-5 py-3 shadow-[0_-3px_0_var(--ink)]">
        <PixelButton type="submit" disabled={!canStart} variant="pink" fullWidth>
          <Play size={16} fill="currentColor" /> {saving ? "正在保存..." : "开始体验"}
        </PixelButton>
        <button
          type="button"
          onClick={fillDemoLogin}
          className="mt-2 inline-flex min-h-9 items-center justify-center gap-2 font-pixel text-[8px] text-ink/70 underline underline-offset-4"
        >
          <LogIn size={15} /> {PUBLIC_DEMO_MODE ? "恢复演示资料" : "使用演示账号"}
        </button>
      </div>
    </form>
  );
}
