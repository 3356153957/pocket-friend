import { House, Map, Settings as SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { AppTab, Prefs } from "../app/appFlow.ts";
import type { ProductProfile } from "../app/productApi.ts";
import type { ScreenResident } from "../app/screenResident.ts";
import type { NearbyDemoController } from "../app/useNearbyDemo.ts";
import HomeWorld from "./HomeWorld.tsx";
import MatchingMap from "./MatchingMap.tsx";
import Settings from "./Settings.tsx";

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="phone-frame">
      <div className="phone-hardware">
        <div className="phone-screen">
          <div className="phone-status" aria-hidden="true">
            <span>9:41</span>
            <span>pocket network&nbsp; [===]</span>
          </div>
          <div className="phone-viewport">{children}</div>
        </div>
      </div>
      <div className="mt-3 text-center font-pixel text-[8px] text-ink/60">pocket friend · 网页演示</div>
    </div>
  );
}

export function BottomTabs({ tab, setTab }: { tab: AppTab; setTab: (tab: AppTab) => void }) {
  const items = [
    { key: "map" as const, label: "地图", Icon: Map },
    { key: "pals" as const, label: "好友", Icon: House },
    { key: "settings" as const, label: "设置", Icon: SettingsIcon },
  ];

  return (
    <nav className="pixel-tabs" aria-label="主要页面">
      {items.map(({ key, label, Icon }) => {
        const active = tab === key;
        return (
          <button
            type="button"
            key={key}
            onClick={() => setTab(key)}
            aria-current={active ? "page" : undefined}
            className={`pixel-tab ${active ? "bg-pink" : "bg-mint"}`}
          >
            <Icon size={20} strokeWidth={2.5} aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default function AppShell({
  tab,
  setTab,
  prefs,
  setPrefs,
  nearby,
  resident,
  productProfile,
  setProductProfile,
  backendWarning,
  setBackendWarning,
}: {
  tab: AppTab;
  setTab: (tab: AppTab) => void;
  prefs: Prefs;
  setPrefs: (prefs: Prefs) => void;
  nearby: NearbyDemoController;
  resident?: ScreenResident | null;
  productProfile?: ProductProfile | null;
  setProductProfile?: (profile: ProductProfile | null) => void;
  backendWarning?: string | null;
  setBackendWarning?: (warning: string | null) => void;
}) {
  return (
    <div className="relative flex h-full flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto pb-24">
        {tab === "map" && <MatchingMap nearby={nearby} />}
        {tab === "pals" && <HomeWorld resident={resident} />}
        {tab === "settings" && (
          <Settings
            prefs={prefs}
            setPrefs={setPrefs}
            productProfile={productProfile}
            setProductProfile={setProductProfile}
            resident={resident}
            backendWarning={backendWarning}
            setBackendWarning={setBackendWarning}
          />
        )}
      </main>
      <BottomTabs tab={tab} setTab={setTab} />
    </div>
  );
}
