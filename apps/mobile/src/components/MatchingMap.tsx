import { ArrowRight, LocateFixed, Radar, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import type { NearbyDemoController } from "../app/useNearbyDemo.ts";
import AmapNearbyMap from "../map/AmapNearbyMap.tsx";
import { buildMapMarkers, type MapFocusRequest } from "../map/mapModel.ts";

interface MatchingMapProps {
  nearby: NearbyDemoController;
  onEnterHome: () => void;
}

const avatarLabels = {
  mint: "PF",
  coral: "狐",
  sun: "日",
  sky: "K",
  violet: "芽",
} as const;

export default function MatchingMap({ nearby, onEnterHome }: MatchingMapProps) {
  const [caught, setCaught] = useState<string[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<MapFocusRequest>({ kind: "hupan", nonce: 0 });
  const selectedPlayer = nearby.state?.visiblePlayers.find((player) => player.id === selectedPlayerId) ?? null;
  const selectedMatch = nearby.state?.nearbyMatches.find((match) => match.player.id === selectedPlayerId) ?? null;
  const isCaught = selectedPlayer ? caught.includes(selectedPlayer.id) : false;
  const markers = useMemo(() => buildMapMarkers(
    nearby.state?.visiblePlayers ?? [],
    selectedPlayerId,
  ), [nearby.state?.visiblePlayers, selectedPlayerId]);
  const nearbyCount = nearby.state?.visiblePlayers.filter((player) => !player.isSelf).length ?? 0;

  function selectPlayer(playerId: string) {
    const player = nearby.state?.visiblePlayers.find((candidate) => candidate.id === playerId);
    if (player?.isSelf) {
      setFocusRequest((previous) => ({ kind: "self", nonce: (previous.nonce ?? 0) + 1 }));
      return;
    }
    setSelectedPlayerId(playerId);
    setFocusRequest((previous) => ({ kind: "player", playerId, nonce: (previous.nonce ?? 0) + 1 }));
  }

  function simulateBuzz() {
    if (!selectedPlayer || selectedPlayer.isSelf) return;
    setCaught((current) => current.includes(selectedPlayer.id) ? current : [...current, selectedPlayer.id]);
  }

  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-[1.45fr_0.85fr]">
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-lg">
        <AmapNearbyMap
          focusRequest={focusRequest}
          markers={markers}
          sourceLabel={nearby.mode === "native" ? "GPS" : "DEMO"}
          onSelectPlayer={selectPlayer}
        />
        <div className="flex flex-col gap-4 border-t border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs text-muted-foreground">附近有 {nearbyCount} 个磁场接近的人</div>
            <div className="mt-1 font-serif-display text-xl text-teal-deep">带着挂坠去逛一逛，让它替你先说「嗨」</div>
          </div>
          <button type="button" onClick={onEnterHome} className="interactive command-button shrink-0 border border-teal-deep bg-transparent text-teal-deep">去我的小家园 <ArrowRight size={17} /></button>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">感应对象</div>
            {selectedMatch && <span className="rounded-full bg-secondary px-2 py-1 text-[11px] text-teal-deep">匹配 {selectedMatch.score}%</span>}
          </div>

          {!nearby.state && (
            <div className="mt-4 space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">{nearby.message}</p>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => void nearby.retryGps()} disabled={nearby.loading} className="interactive command-button w-full bg-teal-deep text-white disabled:opacity-50"><LocateFixed size={17} /> 重新定位</button>
                <button type="button" onClick={() => void nearby.useDemoLocation()} disabled={nearby.loading} className="interactive command-button w-full border border-border bg-card text-teal-deep disabled:opacity-50"><RotateCcw size={17} /> 使用演示位置</button>
              </div>
            </div>
          )}

          {nearby.state && !selectedPlayer && (
            <div className="mt-4 text-sm leading-relaxed text-muted-foreground">点地图上的匿名人物。除非你们的挂坠真的碰过，否则这里只会显示一个「？」。</div>
          )}

          {selectedPlayer && !selectedPlayer.isSelf && !isCaught && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-teal-deep text-xl text-white">?</div>
                <div><div className="font-serif-display text-2xl text-teal-deep">???</div><div className="text-xs text-muted-foreground">{selectedMatch?.displayDistance ?? "距离暂不公开"}</div></div>
              </div>
              <div className="rounded-2xl bg-secondary p-3 text-xs leading-relaxed text-muted-foreground">挂坠还没碰上。资料在你们真的擦肩而过之前保持隐藏，这是 Pocket Friend 的规矩。</div>
              <button type="button" onClick={simulateBuzz} className="interactive command-button w-full bg-coral text-white"><Radar size={17} /> 模拟一次挂坠碰撞</button>
            </div>
          )}

          {selectedPlayer && !selectedPlayer.isSelf && isCaught && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-coral text-lg font-semibold text-white">{avatarLabels[selectedPlayer.avatar]}</div>
                <div><div className="font-serif-display text-2xl text-teal-deep">{selectedPlayer.displayName}</div><div className="text-xs text-muted-foreground">{selectedMatch?.reason ?? "你们刚刚在附近相遇"}</div></div>
              </div>
              <div className="flex flex-wrap gap-2">{(selectedMatch?.sharedInterests ?? []).map((interest) => <span key={interest} className="rounded-full bg-secondary px-3 py-1 text-xs text-teal-deep">#{interest}</span>)}</div>
              <div className="flex flex-wrap gap-2"><button type="button" className="interactive command-button flex-1 bg-teal-deep text-white">发条消息</button><button type="button" className="interactive command-button border border-border bg-card text-teal-deep">收进家园</button></div>
            </div>
          )}

          {selectedPlayer?.isSelf && <div className="mt-4 text-sm text-muted-foreground">这是你当前在地图上的位置。</div>}
        </div>

        <div className="rounded-3xl border border-dashed border-border bg-card/70 p-5">
          <div className="font-serif-display text-lg text-teal-deep">定位状态</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{nearby.message}</p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => void nearby.retryGps()} disabled={nearby.loading} className="interactive map-secondary-button"><LocateFixed size={16} /> GPS</button>
            <button type="button" onClick={() => void nearby.useDemoLocation()} disabled={nearby.loading} className="interactive map-secondary-button"><RotateCcw size={16} /> 演示</button>
          </div>
        </div>
      </aside>
    </section>
  );
}
