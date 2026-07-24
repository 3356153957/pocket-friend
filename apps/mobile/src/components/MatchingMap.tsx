import { ArrowRight, LocateFixed, MapPinned, RotateCcw } from "lucide-react";

import type { NearbyDemoController } from "../app/useNearbyDemo.ts";

interface MatchingMapProps {
  nearby: NearbyDemoController;
  onEnterHome: () => void;
}

export default function MatchingMap({ nearby, onEnterHome }: MatchingMapProps) {
  return (
    <section className="mt-8">
      <div className="grid min-h-[560px] place-items-center rounded-3xl border border-border bg-card p-6 text-center shadow-lg">
        <div className="max-w-md">
          <MapPinned className="mx-auto text-coral" size={42} aria-hidden="true" />
          <h2 className="mt-4 font-serif-display text-4xl text-teal-deep">{nearby.loading ? "正在寻找你的位置" : "附近地图即将出现"}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{nearby.message}{nearby.state ? ` · ${nearby.state.statusText}` : ""}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => void nearby.retryGps()} disabled={nearby.loading} className="interactive command-button bg-teal-deep text-white disabled:opacity-50"><LocateFixed size={17} /> 重新定位</button>
            <button type="button" onClick={() => void nearby.useDemoLocation()} disabled={nearby.loading} className="interactive command-button border border-border bg-card text-teal-deep disabled:opacity-50"><RotateCcw size={17} /> 使用演示位置</button>
          </div>
          <button type="button" onClick={onEnterHome} className="interactive command-button mx-auto mt-4 border border-teal-deep bg-transparent text-teal-deep">先看看我的小家园 <ArrowRight size={17} /></button>
        </div>
      </div>
    </section>
  );
}
