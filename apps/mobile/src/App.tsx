import { useEffect, useRef, useState } from "react";

import {
  createInitialPrefs,
  type AppTab,
  type OnboardingStep,
  type Prefs,
} from "./app/appFlow.ts";
import {
  saveProductResident,
  upsertProductProfile,
  type ProductProfile,
  type ProductProfileDraft,
} from "./app/productApi.ts";
import {
  fetchHardwarePhotoCandidates,
  type HardwarePhotoCandidate,
} from "./app/photoPipeline.ts";
import { photosInUploadOrder } from "./app/photoUpdateQueue.ts";
import { PUBLIC_DEMO_MODE } from "./app/publicDemoRuntime.ts";
import { useNearbyDemo } from "./app/useNearbyDemo.ts";
import type { ScreenResident } from "./app/screenResident.ts";
import Arrival from "./components/Arrival.tsx";
import AppShell, { PhoneFrame } from "./components/AppShell.tsx";
import PendantSetup from "./components/PendantSetup.tsx";
import Quiz from "./components/Quiz.tsx";
import Welcome from "./components/Welcome.tsx";
import {
  createPresenceUrl,
  getPresenceClientId,
  startPresenceHeartbeat,
} from "./presence/presenceHeartbeat.ts";

const PHOTO_UPDATE_POLL_INTERVAL_MS = 3000;

interface ArrivalBatch {
  candidates: HardwarePhotoCandidate[];
  knownPhotoIds: string[];
}

export default function App() {
  const [phase, setPhase] = useState<"onboarding" | "app">("onboarding");
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [tab, setTab] = useState<AppTab>("map");
  const [prefs, setPrefs] = useState<Prefs>(createInitialPrefs);
  const [screenResident, setScreenResident] = useState<ScreenResident | null>(null);
  const [productProfile, setProductProfile] = useState<ProductProfile | null>(null);
  const [backendWarning, setBackendWarning] = useState<string | null>(null);
  const [arrivalBatch, setArrivalBatch] = useState<ArrivalBatch | null>(null);
  const knownPhotoIdsRef = useRef<Set<string> | null>(null);
  const nearby = useNearbyDemo(prefs);

  useEffect(() => {
    if (PUBLIC_DEMO_MODE) return undefined;

    try {
      const clientId = getPresenceClientId(window.localStorage, () => crypto.randomUUID());
      return startPresenceHeartbeat({
        endpoint: createPresenceUrl(window.location, import.meta.env.VITE_ADMIN_URL),
        clientId,
      });
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (PUBLIC_DEMO_MODE) return undefined;
    if (phase !== "app" || !prefs.encounterProfile) return undefined;

    let disposed = false;
    let polling = false;
    async function pollForPhotoUpdates() {
      if (polling) return;
      polling = true;
      try {
        const newestFirst = await fetchHardwarePhotoCandidates();
        const currentIds = new Set(newestFirst.map((candidate) => candidate.id));
        const knownIds = knownPhotoIdsRef.current;
        knownPhotoIdsRef.current = currentIds;
        if (disposed) return;

        if (!knownIds) return;

        const candidates = photosInUploadOrder(
          newestFirst.filter((candidate) => !knownIds.has(candidate.id)),
        );
        if (candidates.length > 0) {
          setArrivalBatch({
            candidates,
            knownPhotoIds: [...currentIds],
          });
          setStep("arrival");
          setPhase("onboarding");
        }
      } catch {
        // Keep the island usable while the hardware photo service is temporarily offline.
      } finally {
        polling = false;
      }
    }

    void pollForPhotoUpdates();
    const timer = window.setInterval(() => void pollForPhotoUpdates(), PHOTO_UPDATE_POLL_INTERVAL_MS);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [phase, prefs.encounterProfile]);

  async function startWithProfile(profile: ProductProfileDraft) {
    setBackendWarning(null);
    if (PUBLIC_DEMO_MODE) {
      const now = new Date().toISOString();
      setProductProfile({
        id: `local-${Date.now().toString(36)}`,
        name: profile.name,
        handle: profile.handle ?? profile.name,
        role: profile.role ?? "",
        bio: profile.bio ?? "",
        createdAt: now,
        updatedAt: now,
      });
      setBackendWarning("公开演示版：资料仅保存在当前页面，不会上传。");
      setStep("quiz");
      return;
    }

    try {
      const savedProfile = await upsertProductProfile(profile);
      setProductProfile(savedProfile);
    } catch (error) {
      setBackendWarning(error instanceof Error ? error.message : "产品服务暂时不可用。");
      setProductProfile({
        id: `local-${Date.now().toString(36)}`,
        name: profile.name,
        handle: profile.handle ?? profile.name,
        role: profile.role ?? "",
        bio: profile.bio ?? "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    setStep("quiz");
  }

  async function saveArrivalResident(resident: ScreenResident, _attemptedPhotoId: string | null) {
    if (PUBLIC_DEMO_MODE || resident.source === "demo") {
      setBackendWarning(PUBLIC_DEMO_MODE
        ? "公开演示版：居民仅在当前页面显示，不会上传。"
        : resident.spriteSource === "local-fallback"
        ? "未获取到硬件照片，因此没有保存居民。请拍摄真实照片后重新进入。"
        : null);
      setScreenResident((current) => current ?? resident);
      return;
    }

    try {
      const savedResident = await saveProductResident({
        profile: productProfile,
        resident,
        prefs,
        encounterProfile: prefs.encounterProfile,
      });
      setScreenResident(savedResident);
      window.localStorage.setItem("pf:last-screen-resident", JSON.stringify(savedResident));
      setBackendWarning(null);
    } catch (error) {
      setBackendWarning(error instanceof Error ? error.message : "居民保存失败。");
      setScreenResident(resident);
    }
  }

  function completeArrival(_finalPhotoId: string | null) {
    setArrivalBatch(null);
    setTab("pals");
    setPhase("app");
  }

  return (
    <div className="min-h-screen bg-paper px-3 py-5 text-foreground sm:py-8">
      <PhoneFrame>
        {phase === "onboarding" && step === "welcome" && <Welcome onStart={startWithProfile} />}
        {phase === "onboarding" && step === "quiz" && (
          <Quiz prefs={prefs} setPrefs={setPrefs} onBack={() => setStep("welcome")} onNext={() => setStep("pendant")} />
        )}
        {phase === "onboarding" && step === "pendant" && (
          <PendantSetup
            prefs={prefs}
            setPrefs={setPrefs}
            onBack={() => setStep("quiz")}
            onNext={() => setStep("arrival")}
          />
        )}
        {phase === "onboarding" && step === "arrival" && prefs.encounterProfile && (
          <Arrival
            profile={prefs.encounterProfile}
            initialCandidates={arrivalBatch?.candidates}
            initialKnownPhotoIds={arrivalBatch?.knownPhotoIds}
            onResidentReady={saveArrivalResident}
            onComplete={completeArrival}
          />
        )}
        {phase === "app" && (
          <AppShell
            tab={tab}
            setTab={setTab}
            prefs={prefs}
            setPrefs={setPrefs}
            nearby={nearby}
            resident={screenResident}
            productProfile={productProfile}
            setProductProfile={setProductProfile}
            backendWarning={backendWarning}
            setBackendWarning={setBackendWarning}
          />
        )}
      </PhoneFrame>
    </div>
  );
}
