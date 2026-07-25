import { Bell, Bluetooth, Database, LockKeyhole, Save, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { Prefs } from "../app/appFlow.ts";
import {
  listProductResidents,
  toScreenResident,
  upsertProductProfile,
  type ProductProfile,
} from "../app/productApi.ts";
import type { ScreenResident } from "../app/screenResident.ts";
import { AppLogo, PixelButton, PixelCard, PixelLabel } from "./PixelUi.tsx";

const buzzOptions = [
  { key: "gentle", label: "gentle tap" },
  { key: "spark", label: "spark buzz" },
  { key: "wave", label: "small wave" },
  { key: "secret", label: "secret mode" },
];

export default function Settings({
  prefs,
  setPrefs,
  productProfile,
  setProductProfile,
  resident,
  backendWarning,
  setBackendWarning,
}: {
  prefs: Prefs;
  setPrefs: (prefs: Prefs) => void;
  productProfile: ProductProfile | null | undefined;
  setProductProfile: ((profile: ProductProfile | null) => void) | undefined;
  resident: ScreenResident | null | undefined;
  backendWarning: string | null | undefined;
  setBackendWarning: ((warning: string | null) => void) | undefined;
}) {
  const [name, setName] = useState(productProfile?.name ?? "");
  const [role, setRole] = useState(productProfile?.role ?? "");
  const [bio, setBio] = useState(productProfile?.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [savedResidents, setSavedResidents] = useState<ScreenResident[]>([]);

  useEffect(() => {
    setName(productProfile?.name ?? "");
    setRole(productProfile?.role ?? "");
    setBio(productProfile?.bio ?? "");
  }, [productProfile]);

  useEffect(() => {
    let disposed = false;
    async function loadResidents() {
      try {
        const residents = await listProductResidents();
        if (!disposed) setSavedResidents(residents.map((item) => toScreenResident(item)));
      } catch {
        if (!disposed) setSavedResidents([]);
      }
    }
    void loadResidents();
    return () => {
      disposed = true;
    };
  }, [resident]);

  const visibleResidents = useMemo(() => {
    const merged = new Map<string, ScreenResident>();
    for (const item of savedResidents) merged.set(item.id, item);
    if (resident && resident.source !== "demo") merged.set(resident.id, resident);
    return [...merged.values()];
  }, [resident, savedResidents]);

  async function saveProfile() {
    if (!productProfile || !name.trim()) return;
    setSaving(true);
    try {
      const saved = await upsertProductProfile({
        id: productProfile.id,
        name: name.trim(),
        handle: productProfile.handle,
        role: role.trim(),
        bio: bio.trim(),
      });
      setProductProfile?.(saved);
      setBackendWarning?.(null);
    } catch (error) {
      setBackendWarning?.(error instanceof Error ? error.message : "Profile save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 px-3 py-4">
      <div className="flex items-center gap-2">
        <AppLogo size={34} />
        <div>
          <h1 className="font-pixel text-[10px] text-ink">SETTINGS</h1>
          <p className="font-mono-pixel text-sm text-ink/70">profile · residents · backend</p>
        </div>
      </div>

      {backendWarning && (
        <PixelCard color="pink">
          <p className="font-mono-pixel text-sm leading-5 text-ink">Backend notice: {backendWarning}</p>
        </PixelCard>
      )}

      <PixelCard color="mint" className="space-y-3">
        <div className="flex items-center gap-3">
          <Database size={24} aria-hidden="true" />
          <div>
            <div className="font-pixel text-[9px] text-ink">PRODUCT BACKEND</div>
            <div className="font-mono-pixel text-sm text-ink/70">profile / resident / scene state</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 font-pixel text-[7px]">
          <span className="pixel-border-sm bg-lime px-2 py-1">PROFILE {productProfile ? "SAVED" : "LOCAL"}</span>
          <span className="pixel-border-sm bg-cyan px-2 py-1">RESIDENTS {visibleResidents.length}</span>
        </div>
      </PixelCard>

      <PixelCard color="card" className="space-y-3">
        <div className="flex items-center gap-2">
          <UserRound size={18} />
          <PixelLabel>ACCOUNT PROFILE</PixelLabel>
        </div>
        <label className="block">
          <span className="font-pixel text-[7px] text-ink/60">NAME</span>
          <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full border-[3px] border-ink bg-mint px-3 py-2 font-mono-pixel text-sm outline-none" />
        </label>
        <label className="block">
          <span className="font-pixel text-[7px] text-ink/60">ROLE</span>
          <input value={role} onChange={(event) => setRole(event.target.value)} className="mt-1 w-full border-[3px] border-ink bg-mint px-3 py-2 font-mono-pixel text-sm outline-none" />
        </label>
        <label className="block">
          <span className="font-pixel text-[7px] text-ink/60">BIO</span>
          <textarea value={bio} onChange={(event) => setBio(event.target.value)} className="mt-1 min-h-16 w-full resize-none border-[3px] border-ink bg-mint px-3 py-2 font-mono-pixel text-sm outline-none" />
        </label>
        <PixelButton onClick={saveProfile} disabled={!productProfile || saving || !name.trim()} variant="lime" fullWidth>
          <Save size={16} /> {saving ? "SAVING..." : "SAVE PROFILE"}
        </PixelButton>
      </PixelCard>

      <PixelCard color="card" className="space-y-3">
        <PixelLabel>RESIDENT DATA</PixelLabel>
        {visibleResidents.length === 0 ? (
          <p className="border-2 border-ink bg-mint p-2 font-mono-pixel text-sm leading-5">
            No real resident saved yet. Run arrival after a hardware photo is captured.
          </p>
        ) : (
          visibleResidents.slice(0, 8).map((item) => (
            <div key={item.id} className="border-2 border-ink bg-mint p-2">
              <div className="flex gap-2">
                <div className="grid h-14 w-14 place-items-center overflow-hidden border-[3px] border-ink bg-card">
                  {item.portraitUrl ? <img src={item.portraitUrl} alt="real reference" className="h-full w-full object-cover" /> : "REF"}
                </div>
                <div className="grid h-14 w-14 place-items-center overflow-hidden border-[3px] border-ink bg-card">
                  <img src={item.pixelPortraitUrl} alt="pixel sprite" className="h-full w-full object-contain pixel-image" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-pixel text-[9px]">{item.name}</div>
                  <div className="mt-1 truncate font-mono-pixel text-sm text-ink/70">{item.magnetType}</div>
                  <div className="mt-1 font-pixel text-[6px] text-ink/55">{item.spriteSource === "seedream" ? "SEEDREAM SPRITE" : "LOCAL FALLBACK"}</div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {item.tags.slice(0, 5).map((tag) => <span key={`${item.id}-${tag}`} className="pixel-tag bg-cyan">#{tag}</span>)}
              </div>
            </div>
          ))
        )}
      </PixelCard>

      <PixelCard color="mint">
        <div className="flex items-center gap-3">
          <Bluetooth size={28} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="font-pixel text-[9px] text-ink">PENDANT · DEMO</div>
            <div className="font-mono-pixel text-sm text-ink/70">hardware bridge feeds latest photo</div>
          </div>
          <span className="pixel-border-sm bg-lime px-2 py-1 font-pixel text-[7px]">READY</span>
        </div>
      </PixelCard>

      <fieldset>
        <PixelLabel>BUZZ MODE</PixelLabel>
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
        <PixelLabel>RADIUS · {prefs.radius}m</PixelLabel>
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

      <div className="space-y-2">
        {([
          [LockKeyhole, "privacy rules"],
          [Bell, "notification preferences"],
        ] as const).map(([Icon, label]) => (
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
