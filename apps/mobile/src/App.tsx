import { useEffect, useState } from "react";

import {
  createInitialPrefs,
  type AppTab,
  type OnboardingStep,
  type Prefs,
} from "./app/appFlow.ts";
import { useNearbyDemo } from "./app/useNearbyDemo.ts";
import AppShell, { PhoneFrame } from "./components/AppShell.tsx";
import PendantSetup from "./components/PendantSetup.tsx";
import Quiz from "./components/Quiz.tsx";
import Welcome from "./components/Welcome.tsx";
import {
  createPresenceUrl,
  getPresenceClientId,
  startPresenceHeartbeat,
} from "./presence/presenceHeartbeat.ts";

export default function App() {
  const [phase, setPhase] = useState<"onboarding" | "app">("onboarding");
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [tab, setTab] = useState<AppTab>("map");
  const [prefs, setPrefs] = useState<Prefs>(createInitialPrefs);
  const nearby = useNearbyDemo(prefs);

  useEffect(() => {
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

  return (
    <div className="min-h-screen bg-paper px-3 py-5 text-foreground sm:py-8">
      <PhoneFrame>
        {phase === "onboarding" && step === "welcome" && <Welcome onStart={() => setStep("quiz")} />}
        {phase === "onboarding" && step === "quiz" && (
          <Quiz prefs={prefs} setPrefs={setPrefs} onBack={() => setStep("welcome")} onNext={() => setStep("pendant")} />
        )}
        {phase === "onboarding" && step === "pendant" && (
          <PendantSetup
            prefs={prefs}
            setPrefs={setPrefs}
            onBack={() => setStep("quiz")}
            onNext={() => setPhase("app")}
          />
        )}
        {phase === "app" && (
          <AppShell tab={tab} setTab={setTab} prefs={prefs} setPrefs={setPrefs} nearby={nearby} />
        )}
      </PhoneFrame>
    </div>
  );
}
