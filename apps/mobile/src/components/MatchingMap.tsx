import { LocateFixed, Radar, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import type { NearbyDemoController } from "../app/useNearbyDemo.ts";
import { getLocationBadge } from "../location/locationBadge.ts";
import AmapNearbyMap from "../map/AmapNearbyMap.tsx";
import { buildMapMarkers, type MapFocusRequest } from "../map/mapModel.ts";
import { AppLogo, PixelButton, PixelCard } from "./PixelUi.tsx";

const avatarLabels = { mint: "PF", coral: "狐", sun: "日", sky: "K", violet: "芽" } as const;

export default function MatchingMap({ nearby }: { nearby: NearbyDemoController }) {
  const [caught, setCaught] = useState<string[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<MapFocusRequest>({ kind: "hupan", nonce: 0 });
  const selectedPlayer = nearby.state?.visiblePlayers.find((player) => player.id === selectedPlayerId) ?? null;
  const selectedMatch = nearby.state?.nearbyMatches.find((match) => match.player.id === selectedPlayerId) ?? null;
  const isCaught = selectedPlayer ? caught.includes(selectedPlayer.id) : false;
  const markers = useMemo(() => buildMapMarkers(nearby.state?.visiblePlayers ?? [], selectedPlayerId), [nearby.state?.visiblePlayers, selectedPlayerId]);
  const people = nearby.state?.visiblePlayers.filter((player) => !player.isSelf) ?? [];
  const locationBadge = getLocationBadge(nearby);

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
    <section className="space-y-3 px-3 py-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <AppLogo size={34} />
          <div className="min-w-0"><h1 className="font-pixel text-[9px]">POCKET FRIEND</h1><p className="truncate font-mono-pixel text-sm text-ink/70">附近 {people.length} 位磁场接近</p></div>
        </div>
        <span className="pixel-border-sm bg-lime px-2 py-1 font-pixel text-[7px]">{locationBadge}</span>
      </header>

      <div className="pixel-border-sm overflow-hidden bg-ink">
        <AmapNearbyMap focusRequest={focusRequest} markers={markers} sourceLabel={locationBadge} onSelectPlayer={selectPlayer} />
      </div>

      <PixelCard color="card">
        {!nearby.state && (
          <div className="space-y-3">
            <p className="font-mono-pixel text-sm leading-5 text-ink/75">{nearby.message}</p>
            <div className="grid grid-cols-2 gap-2">
              <PixelButton onClick={() => void nearby.retryGps()} disabled={nearby.loading}><LocateFixed size={15} /> GPS</PixelButton>
              <PixelButton onClick={() => void nearby.useDemoLocation()} disabled={nearby.loading} variant="lime"><RotateCcw size={15} /> DEMO</PixelButton>
            </div>
          </div>
        )}

        {nearby.state && !selectedPlayer && <p className="font-mono-pixel text-sm leading-5 text-ink/75">点地图上的匿名人物。挂坠碰上之前，只显示「?」。</p>}

        {selectedPlayer && !selectedPlayer.isSelf && !isCaught && (
          <div className="space-y-3">
            <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center border-[3px] border-ink bg-ink font-pixel text-lime">?</div><div className="flex-1"><div className="font-pixel text-[10px]">???</div><div className="font-mono-pixel text-sm text-ink/70">{selectedMatch?.displayDistance ?? "距离暂不公开"}</div></div><span className="pixel-border-sm bg-lime px-2 py-1 font-pixel text-[7px]">{selectedMatch?.score ?? 0}%</span></div>
            <p className="font-mono-pixel text-sm text-ink/70">资料在你们真的擦肩而过之前保持隐藏。</p>
            <PixelButton onClick={simulateBuzz} variant="pink" fullWidth><Radar size={15} /> 模拟挂坠碰撞</PixelButton>
          </div>
        )}

        {selectedPlayer && !selectedPlayer.isSelf && isCaught && (
          <div className="space-y-3">
            <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center border-[3px] border-ink bg-pink font-pixel text-[9px]">{avatarLabels[selectedPlayer.avatar]}</div><div><div className="font-pixel text-[10px]">{selectedPlayer.displayName}</div><div className="font-mono-pixel text-sm text-ink/70">{selectedMatch?.reason}</div></div></div>
            <div className="flex flex-wrap gap-2">{(selectedMatch?.sharedInterests ?? []).map((interest) => <span key={interest} className="pixel-tag bg-mint">#{interest}</span>)}</div>
            <div className="grid grid-cols-2 gap-2"><PixelButton>发消息</PixelButton><PixelButton variant="lime">收进家园</PixelButton></div>
          </div>
        )}

        {selectedPlayer?.isSelf && <p className="font-mono-pixel text-sm">这是你当前在地图上的位置。</p>}
      </PixelCard>

      {nearby.state && (
        <div className="space-y-2">
          {people.map((player) => {
            const match = nearby.state!.nearbyMatches.find((candidate) => candidate.player.id === player.id);
            return <button type="button" key={player.id} onClick={() => selectPlayer(player.id)} className={`pixel-setting-row ${selectedPlayerId === player.id ? "bg-pink" : "bg-card"}`}><span className="grid h-8 w-8 place-items-center border-2 border-ink bg-ink font-pixel text-[8px] text-lime">?</span><span className="flex-1 font-mono-pixel text-sm">匿名朋友 · {match?.displayDistance ?? "附近"}</span><span className="font-pixel text-[7px]">{match?.score ?? 0}%</span></button>;
          })}
        </div>
      )}

      <p className="font-mono-pixel text-xs text-ink/65">{nearby.message}</p>
    </section>
  );
}
