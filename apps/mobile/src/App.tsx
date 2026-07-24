import { useState } from "react";

import { createInitialPrefs, type Prefs, type Step } from "./app/appFlow.ts";
import { useNearbyDemo } from "./app/useNearbyDemo.ts";
import HomeWorld from "./components/HomeWorld.tsx";
import MatchingMap from "./components/MatchingMap.tsx";
import PendantSetup from "./components/PendantSetup.tsx";
import Quiz from "./components/Quiz.tsx";
import TopBar from "./components/TopBar.tsx";
import Welcome from "./components/Welcome.tsx";

export default function App() {
  const [step, setStep] = useState<Step>("welcome");
  const [prefs, setPrefs] = useState<Prefs>(createInitialPrefs);
  const nearby = useNearbyDemo(prefs);

  return (
    <div className="min-h-screen bg-paper text-foreground">
      <TopBar step={step} onHome={() => setStep("welcome")} />
      <main className="mx-auto max-w-[1180px] px-4 pb-20 pt-2 sm:px-6 sm:pb-24 sm:pt-6">
        {step === "welcome" && <Welcome onStart={() => setStep("quiz")} />}
        {step === "quiz" && <Quiz prefs={prefs} setPrefs={setPrefs} onNext={() => setStep("pendant")} />}
        {step === "pendant" && <PendantSetup prefs={prefs} setPrefs={setPrefs} onBack={() => setStep("quiz")} onNext={() => setStep("matching")} />}
        {step === "matching" && <MatchingMap nearby={nearby} onEnterHome={() => setStep("home")} />}
        {step === "home" && <HomeWorld onBack={() => setStep("matching")} />}
      </main>
    </div>
  );
}
