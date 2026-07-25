import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { EncounterProfile } from "../app/encounterProfile.ts";
import { createDemoDownloadedPhoto, fetchLatestHardwarePhoto, type DownloadedPhoto } from "../app/photoPipeline.ts";
import { buildScreenResident, type ScreenResident } from "../app/screenResident.ts";
import { AppLogo, PixelCard } from "./PixelUi.tsx";

type ArrivalStage = "fetching" | "generating" | "pixelating" | "entering" | "done";

const ARRIVAL_TOTAL_TIMEOUT_MS = 75000;
const GENERATING_STATUS_DELAY_MS = 2600;
const FALLBACK_BUTTON_DELAY_MS = 18000;

export default function Arrival({ profile, onDone }: {
  profile: EncounterProfile;
  onDone: (resident: ScreenResident) => void;
}) {
  const manualFallback = useRef<((photo: DownloadedPhoto) => void) | null>(null);
  const profileRef = useRef(profile);
  const onDoneRef = useRef(onDone);
  const [stage, setStage] = useState<ArrivalStage>("fetching");
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [canUseDemo, setCanUseDemo] = useState(false);
  const [residentName, setResidentName] = useState("硬件照片");

  useEffect(() => {
    profileRef.current = profile;
    onDoneRef.current = onDone;
  }, [onDone, profile]);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    async function runArrival() {
      setStage("fetching");
      timers.push(setTimeout(() => {
        if (!cancelled) setStage("generating");
      }, GENERATING_STATUS_DELAY_MS));
      timers.push(setTimeout(() => {
        if (!cancelled) setCanUseDemo(true);
      }, FALLBACK_BUTTON_DELAY_MS));

      let totalTimeout: ReturnType<typeof setTimeout> | undefined;
      const timedFallback = new Promise<DownloadedPhoto>((resolve) => {
        totalTimeout = setTimeout(() => {
          void createDemoDownloadedPhoto("照片和 Seedream 处理超过 75 秒，已使用演示头像继续。").then(resolve);
        }, ARRIVAL_TOTAL_TIMEOUT_MS);
      });
      const clickedFallback = new Promise<DownloadedPhoto>((resolve) => {
        manualFallback.current = resolve;
      });
      const photo = await Promise.race([
        fetchLatestHardwarePhoto(),
        timedFallback,
        clickedFallback,
      ]);
      if (totalTimeout) clearTimeout(totalTimeout);
      manualFallback.current = null;
      if (cancelled) return;

      setStage("pixelating");
      setCanUseDemo(false);
      setResidentName(photo.name ?? "Luna");
      setPortraitUrl(photo.pixelPortraitUrl);
      setWarning(photo.warning ?? null);

      timers.push(setTimeout(() => {
        if (cancelled) return;
        setStage("entering");
        const resident = buildScreenResident(profileRef.current, photo);
        console.log("[screen-resident]", resident);
        window.localStorage.setItem("pf:last-screen-resident", JSON.stringify(resident));
        timers.push(setTimeout(() => {
          if (cancelled) return;
          setStage("done");
          onDoneRef.current(resident);
        }, 1200));
      }, 900));
    }

    void runArrival();

    return () => {
      cancelled = true;
      manualFallback.current = null;
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const copy = stage === "fetching"
    ? "FETCHING PHOTO..."
    : stage === "generating"
      ? "GENERATING SPRITE..."
    : stage === "pixelating"
      ? "PIXELATING..."
      : stage === "entering"
        ? "ENTERING ISLAND..."
        : "DONE";

  return (
    <section className="flex min-h-full flex-col justify-center gap-5 px-4 py-5">
      <div>
        <div className="font-pixel text-[8px] text-pink">03 · ARRIVAL</div>
        <h1 className="mt-3 font-pixel text-[14px] leading-7 text-ink">正在把 <span className="text-pink">{residentName}</span> 接入小岛</h1>
      </div>

      <div className="pixel-border bg-mint-screen p-4">
        <div className="relative grid min-h-64 place-items-center overflow-hidden bg-card bg-dotgrid">
          <div className="absolute inset-x-5 top-6 h-2 bg-lime" />
          <div className="absolute bottom-8 h-20 w-56 border-[3px] border-ink bg-lime" />
          <div className="absolute bottom-20 h-24 w-24 border-[3px] border-ink bg-cyan" />
          <div className="absolute bottom-24 left-10 h-12 w-12 border-[3px] border-ink bg-pink" />
          <div className="absolute right-9 top-12 h-10 w-10 border-[3px] border-ink bg-lime" />

          <div className={`relative z-10 grid h-28 w-28 place-items-center border-[4px] border-ink bg-card shadow-[5px_5px_0_var(--ink)] ${stage === "entering" ? "animate-float" : ""}`}>
            {portraitUrl ? (
              <img src={portraitUrl} alt="pixel portrait" className="h-20 w-20 object-contain pixel-image" />
            ) : (
              <AppLogo size={72} />
            )}
          </div>
        </div>
      </div>

      <PixelCard color="card" className="space-y-3">
        <div className="flex items-center gap-3">
          {stage === "done" ? <Check size={18} /> : <Loader2 size={18} className="animate-spin" />}
          <div>
            <div className="font-pixel text-[9px] text-ink">{copy}</div>
            <p className="mt-1 font-mono-pixel text-sm text-ink/70">磁场: {profile.archetype} · {profile.sceneTags.slice(0, 3).join(" / ")}</p>
          </div>
        </div>
        {warning && <p className="font-mono-pixel text-xs leading-4 text-ink/60">提示：{warning}</p>}
        {(stage === "fetching" || stage === "generating") && canUseDemo && (
          <button
            type="button"
            className="pixel-border bg-lime px-3 py-2 font-pixel text-[8px] text-ink shadow-[3px_3px_0_var(--ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--ink)]"
            onClick={() => {
              setCanUseDemo(false);
              void createDemoDownloadedPhoto("已手动使用演示头像继续。").then((photo) => manualFallback.current?.(photo));
            }}
          >
            使用演示头像继续
          </button>
        )}
      </PixelCard>
    </section>
  );
}
