/**
 * <Stage> — engine-agnostic. Reads only RoomState and dispatches through
 * RoomActions. Never imports LiveKit.
 *
 * Layouts adapt instantly to the number of on-stage speakers because
 * effectiveLayout is a pure derivation from the abstract state; changing
 * it does NOT reconnect the room.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
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
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  // A screen share always takes visual priority — bump layout to spotlight-like
  // behavior without persisting to the server.
  const screenSharer = useMemo(
    () => onStage.find((p) => p.isScreenSharing),
    [onStage],
  );

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const update = () => {
      const rect = node.getBoundingClientRect();
      setStageSize((current) =>
        current.width === rect.width && current.height === rect.height
          ? current
          : { width: rect.width, height: rect.height },
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [effectiveLayout, onStage.length, screenSharer?.userId]);

  const compact = stageSize.width > 0 && (stageSize.width < 720 || stageSize.height < 460);

  const spotlightPerson =
    (spotlightUserId && onStage.find((p) => p.userId === spotlightUserId)) ||
    screenSharer ||
    onStage[0];

  const others = onStage.filter((p) => p.userId !== spotlightPerson?.userId);

  if (onStage.length === 0) {
    return (
      <div ref={stageRef} className={cn("grid h-full min-h-0 w-full min-w-0 place-items-center bg-neutral-950 text-white/60", className)}>
        <div className="text-center">
          <div className="text-lg font-medium">A aguardar oradores</div>
          <div className="mt-1 text-sm text-white/40">O palco ficará ativo assim que alguém entrar em direto.</div>
        </div>
      </div>
    );
  }

  if (screenSharer) {
    // Keep the shared frame in its own bounded area. Camera thumbnails use a
    // separate dock so they never cover browser toolbars or shared content.
    const sharerHasCam = Boolean(
      screenSharer.camOn !== false &&
        screenSharer.tracks.some((t) => t.kind === "video" && t.source === "camera" && !t.muted),
    );
    const cameraParticipants = onStage.filter((p) => p.userId !== screenSharer.userId);
    return (
      <div
        ref={stageRef}
        className={cn(
          "relative h-full min-h-0 w-full min-w-0 overflow-hidden bg-black",
          className,
        )}
      >
        <div className={cn("grid h-full min-h-0 w-full min-w-0 gap-2 p-2", compact ? "grid-rows-[minmax(0,1fr)_72px]" : "grid-cols-[minmax(0,1fr)_clamp(120px,22%,180px)]")}>
          <MediaTile
            participant={screenSharer}
            actions={actions}
            preferScreen
            showName={false}
            className="h-full min-h-0 w-full min-w-0 rounded-none ring-0"
          />
          <div
            className={cn(
              "flex min-h-0 min-w-0 gap-2 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              compact ? "flex-row" : "flex-col",
            )}
          >
          {sharerHasCam && (
            <div className={cn("shrink-0 overflow-hidden rounded-lg bg-black shadow-2xl ring-2 ring-[hsl(45_86%_60%)]", compact ? "aspect-video h-full" : "aspect-video w-full")}>
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
            <div key={p.userId} className={cn("shrink-0 overflow-hidden rounded-lg bg-black shadow-2xl ring-1 ring-white/15", compact ? "aspect-video h-full" : "aspect-video w-full")}>
              <MediaTile participant={p} actions={actions} preferScreen={false} className="h-full w-full" />
            </div>
          ))}
          </div>
        </div>
      </div>
    );
  }

  if (effectiveLayout === "spotlight") {
    const primary = spotlightPerson;
    if (!primary) return null;
    return (
      <div ref={stageRef} className={cn("flex h-full min-h-0 w-full min-w-0 gap-2", compact ? "flex-col" : "flex-row", className)}>
        <MediaTile participant={primary} actions={actions} className="min-h-0 min-w-0 flex-1" />
        {others.length > 0 && (
          <div className={cn("flex shrink-0 gap-2 overflow-auto", compact ? "h-24 w-full flex-row" : "h-full w-40 flex-col")}>
            {others.map((p) => (
              <MediaTile key={p.userId} participant={p} actions={actions} className={cn("shrink-0", compact ? "aspect-video h-full" : "aspect-video w-full")} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (effectiveLayout === "solo") {
    return <div ref={stageRef} className="h-full min-h-0 w-full min-w-0"><MediaTile participant={onStage[0]} actions={actions} className={cn("h-full w-full", className)} /></div>;
  }

  if (effectiveLayout === "host_guest") {
    const hostGuestColumns = compact ? 1 : 2;
    const hostGuestRows = Math.ceil(Math.min(onStage.length, 2) / hostGuestColumns);
    return (
      <div
        ref={stageRef}
        className={cn("grid h-full min-h-0 w-full min-w-0 gap-2", className)}
        style={{
          gridTemplateColumns: `repeat(${hostGuestColumns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${hostGuestRows}, minmax(0, 1fr))`,
        }}
      >
        {onStage.slice(0, 2).map((p) => (
          <MediaTile key={p.userId} participant={p} actions={actions} className="h-full min-h-0 min-w-0" />
        ))}
      </div>
    );
  }

  // grid — adaptive
  const cols = compact ? (onStage.length <= 2 ? 1 : 2) : onStage.length <= 4 ? 2 : onStage.length <= 9 ? 3 : 4;
  const rows = Math.ceil(onStage.length / cols);
  return (
    <div
      ref={stageRef}
      className={cn("grid h-full min-h-0 w-full min-w-0 gap-2 overflow-y-auto", className)}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0,1fr))`,
      }}
    >
      {onStage.map((p) => (
        <MediaTile key={p.userId} participant={p} actions={actions} className="min-h-0 min-w-0" />
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
