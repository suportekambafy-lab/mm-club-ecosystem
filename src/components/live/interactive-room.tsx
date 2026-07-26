/**
 * <InteractiveRoom> — top-level shell. Composes:
 *   Backstage (if status==='backstage' + local is publisher)
 *   Stage (main room, once live)
 *   Waiting screen (viewers before host clicks "Entrar em direto")
 *   Controls bar
 *
 * The engine (LiveKit) is bootstrapped by useRoomState; this component
 * only reads the abstract RoomState / RoomActions.
 */
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRoomState } from "@/hooks/use-room-state";
import type { RoomActions, RoomState, StageLayout } from "@/lib/room-state";
import { Stage } from "./stage";
import { Backstage } from "./backstage";
import { RoomControls } from "./room-controls";
import { Hand, Radio, Volume2, X, UserPlus } from "lucide-react";

import {
  goLive,
  endLive,
  raiseHand,
  inviteToStage,
  promoteToStage,
  demoteFromStage,
  setSpotlight,
  setStageLayout,
  kickParticipant,
  banParticipant,
} from "@/lib/live-room.functions";

interface Props {
  liveId: string;
  localUserId: string;
  token: string;
  url: string;
  target: "backstage" | "main";
  onLeave?: () => void;
}

export function InteractiveRoom({ liveId, localUserId, token, url, target, onLeave }: Props) {
  // ----- server RPC bindings -----
  const goLiveFn = useServerFn(goLive);
  const endLiveFn = useServerFn(endLive);
  const raiseHandFn = useServerFn(raiseHand);
  const inviteFn = useServerFn(inviteToStage);
  const promoteFn = useServerFn(promoteToStage);
  const demoteFn = useServerFn(demoteFromStage);
  const spotlightFn = useServerFn(setSpotlight);
  const layoutFn = useServerFn(setStageLayout);
  const kickFn = useServerFn(kickParticipant);
  const banFn = useServerFn(banParticipant);

  const serverActions = useMemo(
    () => ({
      raiseHand: async (raised: boolean) => {
        await raiseHandFn({ data: { liveId, raised } });
      },
      inviteToStage: async (userId: string) => {
        await inviteFn({ data: { liveId, targetUserId: userId } });
      },
      promoteToStage: async (userId: string, opts?: { role?: "speaker" | "cohost" }) => {
        await promoteFn({
          data: { liveId, targetUserId: userId, role: opts?.role ?? "speaker", mic: true, cam: true, screen: true },
        });
      },
      demoteFromStage: async (userId: string) => {
        await demoteFn({ data: { liveId, targetUserId: userId } });
      },
      setSpotlight: async (userId: string | null) => {
        await spotlightFn({ data: { liveId, targetUserId: userId } });
      },
      setLayout: async (layout: StageLayout) => {
        // Server accepts explicit layouts; "auto" is stored as-is and resolved client-side.
        await layoutFn({ data: { liveId, layout } });
      },
      goLive: async () => {
        await goLiveFn({ data: { liveId } });
      },
      endLive: async () => {
        await endLiveFn({ data: { liveId } });
      },
      kick: async (userId: string) => {
        await kickFn({ data: { liveId, targetUserId: userId } });
      },
      ban: async (userId: string) => {
        await banFn({ data: { liveId, targetUserId: userId } });
      },
    }),
    [liveId, goLiveFn, endLiveFn, raiseHandFn, inviteFn, promoteFn, demoteFn, spotlightFn, layoutFn, kickFn, banFn],
  );

  const { state, actions } = useRoomState({
    liveId,
    localUserId,
    target,
    token,
    url,
    serverActions,
  });

  const [goingLive, setGoingLive] = useState(false);
  const handleGoLive = async () => {
    setGoingLive(true);
    try {
      await actions.goLive();
    } finally {
      setGoingLive(false);
    }
  };

  // Which stage to render?
  const inBackstage = target === "backstage";
  const isPublisher = state.localRole === "host" || state.localRole === "cohost" || state.localRole === "speaker";
  const audienceWaiting = !inBackstage && state.status !== "live" && state.status !== "ended";

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Connection indicator */}
      {state.connection.state !== "connected" && (
        <div className="absolute inset-x-0 top-0 z-30 flex justify-center pt-2">
          <div className="flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            {state.connection.state === "reconnecting" ? "A reconectar…" : "A conectar…"}
          </div>
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        {inBackstage && isPublisher ? (
          <Backstage state={state} actions={actions} onGoLive={handleGoLive} goingLive={goingLive} />
        ) : audienceWaiting ? (
          <AudienceWaiting />
        ) : (
          <Stage state={state} actions={actions} className="h-full w-full" />
        )}
      </div>

      {/* Floating controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
        <RoomControls state={state} actions={actions} onLeave={onLeave} />
      </div>
    </div>
  );
}

function AudienceWaiting() {
  return (
    <div className="grid h-full w-full place-items-center bg-neutral-950 text-center text-white/80">
      <div className="max-w-sm px-6">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-500/10">
          <Radio className="h-6 w-6 text-amber-400" />
        </div>
        <div className="mt-4 text-lg font-semibold">A começar em breve</div>
        <p className="mt-2 text-sm text-white/60">
          O anfitrião está a preparar a sessão no backstage. A transmissão começa assim que ele entrar em direto.
        </p>
      </div>
    </div>
  );
}
