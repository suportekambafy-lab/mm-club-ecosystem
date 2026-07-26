/**
 * <Backstage> — private rehearsal room for host + speakers.
 * Viewers cannot access this route (server-side check in joinRoom).
 * Only when the host clicks "Entrar em direto" does the audience start
 * seeing the main room.
 */
import type { RoomActions, RoomState } from "@/lib/room-state";
import { Button } from "@/components/ui/button";
import { Radio } from "lucide-react";
import { MediaTile } from "./media-tile";

interface BackstageProps {
  state: RoomState;
  actions: RoomActions;
  onGoLive: () => Promise<void>;
  goingLive?: boolean;
}

export function Backstage({ state, actions, onGoLive, goingLive }: BackstageProps) {
  const canGoLive = state.localRole === "host" || state.localRole === "cohost";
  const speakers = state.participants.filter((p) => p.room === "backstage");

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/15">
            <Radio className="h-4 w-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">Backstage privado</div>
            <div className="truncate text-xs text-white/60">Só tu e os oradores conseguem ver e ouvir. Os espectadores ainda estão em espera.</div>
          </div>
        </div>
        {canGoLive && (
          <Button
            size="sm"
            onClick={onGoLive}
            disabled={goingLive}
            className="shrink-0 bg-gradient-to-r from-red-500 to-red-600 font-semibold text-white hover:from-red-500 hover:to-red-500"
          >
            {goingLive ? "A entrar…" : "Entrar em direto"}
          </Button>
        )}
      </div>

      <div
        className="grid flex-1 gap-2"
        style={{
          gridTemplateColumns: `repeat(${Math.min(Math.max(speakers.length, 1), 3)}, minmax(0,1fr))`,
        }}
      >
        {speakers.length === 0 ? (
          <div className="grid h-full place-items-center rounded-2xl bg-neutral-950 text-sm text-white/50">
            A aguardar oradores no backstage…
          </div>
        ) : (
          speakers.map((p) => (
            <MediaTile key={p.userId} participant={p} actions={actions} className="min-h-[220px]" />
          ))
        )}
      </div>
    </div>
  );
}
