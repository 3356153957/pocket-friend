import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { EncounterProfile } from "../app/encounterProfile.ts";
import {
  createDemoDownloadedPhoto,
  fetchHardwarePhotoCandidates,
  processHardwarePhotoCandidate,
  type DownloadedPhoto,
  type HardwarePhotoCandidate,
} from "../app/photoPipeline.ts";
import { PhotoProcessingQueue } from "../app/photoUpdateQueue.ts";
import { buildScreenResident, type ScreenResident } from "../app/screenResident.ts";
import { AppLogo, PixelCard } from "./PixelUi.tsx";

type ArrivalStage = "fetching" | "generating" | "pixelating" | "entering" | "done";

const ARRIVAL_JOB_TIMEOUT_MS = 75000;
const GENERATING_STATUS_DELAY_MS = 2600;
const FALLBACK_BUTTON_DELAY_MS = 18000;
const PHOTO_POLL_INTERVAL_MS = 3000;

interface ArrivalProps {
  profile: EncounterProfile;
  initialCandidates?: HardwarePhotoCandidate[] | undefined;
  initialKnownPhotoIds?: string[] | undefined;
  onResidentReady: (resident: ScreenResident, attemptedPhotoId: string | null) => Promise<void> | void;
  onComplete: (lastAttemptedPhotoId: string | null) => void;
}

interface ProcessedCandidate {
  photo: DownloadedPhoto;
  waitForActiveJob: Promise<void>;
}

export default function Arrival({
  profile,
  initialCandidates,
  initialKnownPhotoIds,
  onResidentReady,
  onComplete,
}: ArrivalProps) {
  const manualFallback = useRef<((photo: DownloadedPhoto) => void) | null>(null);
  const profileRef = useRef(profile);
  const onResidentReadyRef = useRef(onResidentReady);
  const onCompleteRef = useRef(onComplete);
  const [stage, setStage] = useState<ArrivalStage>("fetching");
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [queueNotice, setQueueNotice] = useState<string | null>(null);
  const [canUseDemo, setCanUseDemo] = useState(false);
  const [residentName, setResidentName] = useState("硬件照片");

  useEffect(() => {
    profileRef.current = profile;
    onResidentReadyRef.current = onResidentReady;
    onCompleteRef.current = onComplete;
  }, [onComplete, onResidentReady, profile]);

  useEffect(() => {
    let cancelled = false;
    let pollingPromise: Promise<void> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const queue = new PhotoProcessingQueue<HardwarePhotoCandidate>();

    function schedule(callback: () => void, delayMs: number) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        callback();
      }, delayMs);
      timers.add(timer);
      return timer;
    }

    function cancelTimer(timer: ReturnType<typeof setTimeout> | undefined) {
      if (!timer) return;
      clearTimeout(timer);
      timers.delete(timer);
    }

    function delay(delayMs: number): Promise<void> {
      return new Promise((resolve) => schedule(resolve, delayMs));
    }

    async function pollForNewPhotos() {
      if (pollingPromise) return await pollingPromise;
      pollingPromise = (async () => {
        try {
          const newestFirst = await fetchHardwarePhotoCandidates();
          const added = queue.observeMany([...newestFirst].reverse());
          if (!cancelled && added > 0) {
            setQueueNotice(`检测到 ${added} 张新照片，已加入队列；还有 ${queue.pendingCount} 张待处理。`);
          }
        } catch {
          // A transient polling failure must not interrupt the active Seedream job.
        }
      })();
      try {
        await pollingPromise;
      } finally {
        pollingPromise = null;
      }
    }

    async function loadInitialCandidate(): Promise<HardwarePhotoCandidate | null> {
      if (initialCandidates?.length) {
        queue.observeMany(initialCandidates);
        queue.markSeen(initialKnownPhotoIds ?? []);
        return queue.takePending();
      }

      const newestFirst = await fetchHardwarePhotoCandidates();
      queue.markSeen(newestFirst.map((candidate) => candidate.id));
      const latest = newestFirst[0] ?? null;
      if (latest) queue.start(latest);
      return latest;
    }

    async function processCandidate(candidate: HardwarePhotoCandidate): Promise<ProcessedCandidate> {
      setStage("fetching");
      setPortraitUrl(null);
      setWarning(null);
      setResidentName(candidate.name ?? "硬件照片");
      setQueueNotice(queue.pendingCount > 0 ? `队列中还有 ${queue.pendingCount} 张照片。` : null);
      setCanUseDemo(false);

      const generatingTimer = schedule(() => {
        if (!cancelled) setStage("generating");
      }, GENERATING_STATUS_DELAY_MS);
      const fallbackButtonTimer = schedule(() => {
        if (!cancelled) setCanUseDemo(true);
      }, FALLBACK_BUTTON_DELAY_MS);

      let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
      const timedFallback = new Promise<{ kind: "fallback"; photo: DownloadedPhoto }>((resolve) => {
        timeoutTimer = schedule(() => {
          void createDemoDownloadedPhoto("照片和像素形象处理超过 75 秒，本张照片已使用演示备用方案。").then((photo) => resolve({ kind: "fallback", photo }));
        }, ARRIVAL_JOB_TIMEOUT_MS);
      });
      const clickedFallback = new Promise<{ kind: "fallback"; photo: DownloadedPhoto }>((resolve) => {
        manualFallback.current = (photo) => resolve({ kind: "fallback", photo });
      });
      const processing = processHardwarePhotoCandidate(candidate).catch((error: unknown) => (
        createDemoDownloadedPhoto(error instanceof Error ? error.message : "照片处理失败。")
      ));
      const processingResult = processing.then((photo) => ({ kind: "processed" as const, photo }));
      const result = await Promise.race([processingResult, timedFallback, clickedFallback]);

      cancelTimer(timeoutTimer);
      cancelTimer(generatingTimer);
      cancelTimer(fallbackButtonTimer);
      manualFallback.current = null;
      setCanUseDemo(false);
      return {
        photo: result.photo,
        waitForActiveJob: result.kind === "processed"
          ? Promise.resolve()
          : processing.then(() => undefined, () => undefined),
      };
    }

    async function animateAndSave(photo: DownloadedPhoto, attemptedPhotoId: string | null) {
      setStage("pixelating");
      setResidentName(photo.name ?? "硬件照片");
      setPortraitUrl(photo.pixelPortraitUrl);
      setWarning(photo.warning ?? null);
      await delay(900);
      if (cancelled) return;

      setStage("entering");
      await delay(1200);
      if (cancelled) return;

      const resident = buildScreenResident(profileRef.current, photo);
      console.log("[screen-resident]", resident);
      await onResidentReadyRef.current(resident, attemptedPhotoId);
    }

    async function runArrival() {
      let current: HardwarePhotoCandidate | null = null;
      let lastAttemptedPhotoId: string | null = null;

      try {
        current = await loadInitialCandidate();
      } catch (error) {
        const fallback = await createDemoDownloadedPhoto(error instanceof Error ? error.message : "照片服务暂时不可用。");
        await animateAndSave(fallback, null);
      }

      if (cancelled) return;
      pollInterval = setInterval(() => void pollForNewPhotos(), PHOTO_POLL_INTERVAL_MS);

      while (current && !cancelled) {
        lastAttemptedPhotoId = current.id;
        const processed = await processCandidate(current);
        if (cancelled) break;

        await pollForNewPhotos();
        await animateAndSave(processed.photo, current.id);
        if (cancelled) break;

        if (queue.pendingCount > 0) {
          setQueueNotice(`队列中还有 ${queue.pendingCount} 张照片，等待当前生成任务结束。`);
        }
        await processed.waitForActiveJob;
        if (cancelled) break;

        await pollForNewPhotos();
        current = queue.takePending();
      }

      clearInterval(pollInterval);
      pollInterval = null;
      if (!cancelled) {
        setStage("done");
        onCompleteRef.current(lastAttemptedPhotoId);
      }
    }

    void runArrival();

    return () => {
      cancelled = true;
      manualFallback.current = null;
      if (pollInterval) clearInterval(pollInterval);
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };
  }, [initialCandidates, initialKnownPhotoIds]);

  const copy = stage === "fetching"
    ? "正在获取照片..."
    : stage === "generating"
      ? "正在生成像素形象..."
      : stage === "pixelating"
        ? "像素形象已就绪..."
        : stage === "entering"
          ? "正在进入小岛..."
          : "已完成";

  return (
    <section className="flex min-h-full flex-col justify-center gap-5 px-4 py-5">
      <div>
        <div className="font-pixel text-[8px] text-pink">03 / 抵达</div>
        <h1 className="mt-3 font-pixel text-[14px] leading-7 text-ink">
          正在连接 <span className="text-pink">{residentName}</span> 与小岛
        </h1>
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
              <img src={portraitUrl} alt="像素形象" className="h-20 w-20 object-contain pixel-image" />
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
            <p className="mt-1 font-mono-pixel text-sm text-ink/70">
              磁场：{profile.archetype} / {profile.sceneTags.slice(0, 3).join(" / ")}
            </p>
          </div>
        </div>
        {queueNotice && <p className="font-mono-pixel text-xs leading-4 text-ink/70">{queueNotice}</p>}
        {warning && <p className="font-mono-pixel text-xs leading-4 text-ink/60">提示：{warning}</p>}
        {(stage === "fetching" || stage === "generating") && canUseDemo && (
          <button
            type="button"
            className="pixel-border bg-lime px-3 py-2 font-pixel text-[8px] text-ink shadow-[3px_3px_0_var(--ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--ink)]"
            onClick={() => {
              setCanUseDemo(false);
              void createDemoDownloadedPhoto("已手动使用演示备用方案，本张照片不会保存为真实居民。").then((photo) => manualFallback.current?.(photo));
            }}
          >
            本张使用演示备用方案
          </button>
        )}
      </PixelCard>
    </section>
  );
}
