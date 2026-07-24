import { ArrowRight, MapPinned } from "lucide-react";

interface MatchingMapProps {
  onEnterHome: () => void;
}

export default function MatchingMap({ onEnterHome }: MatchingMapProps) {
  return (
    <section className="mt-8">
      <div className="grid min-h-[560px] place-items-center rounded-3xl border border-border bg-card p-6 text-center shadow-lg">
        <div className="max-w-md">
          <MapPinned className="mx-auto text-coral" size={42} aria-hidden="true" />
          <h2 className="mt-4 font-serif-display text-4xl text-teal-deep">正在准备附近地图</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Pocket Friend 正在连接定位与高德地图。地图准备好后，附近的匹配对象会出现在真实位置上。</p>
          <button type="button" onClick={onEnterHome} className="interactive command-button mx-auto mt-6 border border-teal-deep bg-transparent text-teal-deep">先看看我的小家园 <ArrowRight size={17} /></button>
        </div>
      </div>
    </section>
  );
}
