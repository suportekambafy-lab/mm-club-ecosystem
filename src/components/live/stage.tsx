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

  if (screenSharer) {
    // A shared screen owns the whole stage. Participant cameras float above it
    // instead of taking a grid column, which used to squeeze wide shares and
    // made browser windows look cropped/zoomed on smaller viewports.
    const sharerHasCam = Boolean(
      screenSharer.camOn !== false &&
        screenSharer.tracks.some((t) => t.kind === "video" && t.source === "camera" && !t.muted),
    );
    const cameraParticipants = onStage.filter((p) => p.userId !== screenSharer.userId);
    return (
      <div className={cn("relative h-full min-h-0 w-full min-w-0 overflow-hidden bg-neutral-950", className)}>
        <MediaTile
          participant={screenSharer}
          actions={actions}
          preferScreen
          showName={false}
          className="absolute inset-0 h-full w-full rounded-none ring-0"
        />
        <div className="pointer-events-none absolute right-3 top-3 z-10 flex max-h-[calc(100%-5rem)] flex-col gap-2 overflow-hidden">
          {sharerHasCam && (
            <div className="aspect-video w-28 overflow-hidden rounded-lg shadow-2xl ring-2 ring-[hsl(45_86%_60%)] sm:w-36 lg:w-44">
              <MediaTile
                participant={screenSharer}
                actions={actions}
                preferScreen={false}
                suppressAudio
                showName={false}
                className="h-full w-full"
              />
            </div>
          )}
          {cameraParticipants.map((p) => (
            <div key={p.userId} className="aspect-video w-28 overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/15 sm:w-36 lg:w-44">
              <MediaTile participant={p} actions={actions} preferScreen={false} className="h-full w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (effectiveLayout === "spotlight") {
    const primary = spotlightPerson!;
    return (
      <div className={cn("grid h-full min-h-0 w-full min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_180px]", className)}>
        <MediaTile participant={primary} actions={actions} className="h-full min-h-[240px] w-full" />
        {others.length > 0 && (
          <div className="flex min-w-0 flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-y-auto">
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
