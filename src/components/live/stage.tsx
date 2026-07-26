/**
 * <Stage> — engine-agnostic. Reads only RoomState and dispatches through
 * RoomActions. Never imports LiveKit.
 *
 * Layouts adapt instantly to the number of on-stage speakers because
 * effectiveLayout is a pure derivation from the abstract state; changing
 * it does NOT reconnect the room.
 */
import { memo, useMemo } from "react";
import type { RoomActions, RoomParticipant, RoomState } from "@/lib/room-state";
import { MediaTile } from "./media-tile";
import { cn } from "@/lib/utils";

interface StageProps {
  state: RoomState;
  actions: RoomActions;
  className?: string;
}

function StageBase({ state, actions, className }: StageProps) {
  const { effectiveLayout, onStage, spotlightUserId } = state;

  // A screen share always takes visual priority — bump layout to spotlight-like
  // behavior without persisting to the server.
  const screenSharer = useMemo(
    () => onStage.find((p) => p.isScreenSharing),
    [onStage],
  );

  const spotlightPerson =
    (spotlightUserId && onStage.find((p) => p.userId === spotlightUserId)) ||
    screenSharer ||
    onStage[0];

  const others = onStage.filter((p) => p.userId !== spotlightPerson?.userId);

  if (onStage.length === 0) {
    return (
      <div className={cn("grid h-full w-full place-items-center rounded-2xl bg-neutral-950 text-white/60", className)}>
        <div className="text-center">
          <div className="text-lg font-medium">A aguardar oradores</div>
          <div className="mt-1 text-sm text-white/40">O palco ficará ativo assim que alguém entrar em direto.</div>
        </div>
      </div>
    );
  }

  if (screenSharer || effectiveLayout === "spotlight") {
    const primary = spotlightPerson!;
    return (
      <div className={cn("grid h-full w-full gap-2 lg:grid-cols-[1fr_auto]", className)}>
        <MediaTile participant={primary} actions={actions} preferScreen={Boolean(screenSharer)} className="h-full min-h-[240px]" />
        {others.length > 0 && (
          <div className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-y-auto lg:w-[180px]">
            {others.map((p) => (
              <MediaTile key={p.userId} participant={p} actions={actions} className="aspect-video h-24 shrink-0 lg:h-auto lg:w-full" />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (effectiveLayout === "solo") {
    return <MediaTile participant={onStage[0]} actions={actions} className={cn("h-full w-full", className)} />;
  }

  if (effectiveLayout === "host_guest") {
    return (
      <div className={cn("grid h-full w-full gap-2 md:grid-cols-2", className)}>
        {onStage.slice(0, 2).map((p) => (
          <MediaTile key={p.userId} participant={p} actions={actions} className="h-full min-h-[220px]" />
        ))}
      </div>
    );
  }

  // grid — adaptive
  const cols = onStage.length <= 4 ? 2 : onStage.length <= 9 ? 3 : 4;
  return (
    <div
      className={cn("grid h-full w-full gap-2", className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
    >
      {onStage.map((p) => (
        <MediaTile key={p.userId} participant={p} actions={actions} className="min-h-[160px]" />
      ))}
    </div>
  );
}

/** Memo: Stage should not re-render on chat, reactions or audience churn. */
export const Stage = memo(StageBase, (a, b) => {
  const sa = a.state;
  const sb = b.state;
  if (sa.effectiveLayout !== sb.effectiveLayout) return false;
  if (sa.spotlightUserId !== sb.spotlightUserId) return false;
  if (sa.onStage.length !== sb.onStage.length) return false;
  for (let i = 0; i < sa.onStage.length; i++) {
    const pa = sa.onStage[i];
    const pb = sb.onStage[i];
    if (pa.userId !== pb.userId) return false;
    if (pa.tracks.length !== pb.tracks.length) return false;
    if (pa.isScreenSharing !== pb.isScreenSharing) return false;
    if (pa.isSpeaking !== pb.isSpeaking) return false;
    if (pa.micOn !== pb.micOn || pa.camOn !== pb.camOn) return false;
  }
  return a.actions === b.actions && a.className === b.className;
});

/** Small helper for consumers: on-stage participant count. */
export function onStageCount(participants: RoomParticipant[]) {
  return participants.filter((p) => p.onStage).length;
}
