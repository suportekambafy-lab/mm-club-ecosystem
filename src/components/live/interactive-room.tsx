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
import { Hand, Radio, X, UserPlus, Users } from "lucide-react";
import { MemberAvatar } from "@/components/mm/member-avatar";
import { useAdminIds } from "@/hooks/use-admin-ids";

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

      {/* Audio autoplay overlay removed — LiveKit + muted <video>/separate <audio>
          handle playback cleanly; no user gesture is needed anymore. */}



      <div className="relative flex-1 overflow-hidden">
        {inBackstage && isPublisher ? (
          <Backstage state={state} actions={actions} onGoLive={handleGoLive} goingLive={goingLive} />
        ) : audienceWaiting ? (
          <AudienceWaiting />
        ) : (
          <Stage state={state} actions={actions} className="h-full w-full" />
        )}
      </div>

      {/* Host-only: raised hands & participants panel */}
      {(state.localRole === "host" || state.localRole === "cohost") && (
        <HostRequestsPanel state={state} actions={actions} />
      )}

      {/* Floating controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
        <RoomControls state={state} actions={actions} onLeave={onLeave} />
      </div>
    </div>
  );
}

function HostRequestsPanel({ state, actions }: { state: RoomState; actions: RoomActions }) {
  const [open, setOpen] = useState(false);
  const raised = useMemo(
    () =>
      state.participants
        .filter((p) => p.handRaisedAt && !p.onStage && !p.banned)
        .sort((a, b) => (a.handRaisedAt ?? "").localeCompare(b.handRaisedAt ?? "")),
    [state.participants],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto absolute right-3 top-3 z-30 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white/85 ring-1 ring-white/10 backdrop-blur-md hover:bg-black/80"
        aria-label="Participantes"
      >
        <Hand className={raised.length > 0 ? "h-4 w-4 text-amber-400" : "h-4 w-4"} />
        {raised.length > 0 && (
          <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-black">{raised.length}</span>
        )}
        <span className="hidden sm:inline">Pedidos</span>
      </button>
      {open && (
        <div className="absolute inset-y-0 right-0 z-40 flex w-[320px] max-w-full flex-col border-l border-white/10 bg-neutral-950/95 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-2.5">
            <div className="text-sm font-semibold">Pedidos para participar</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 hover:bg-white/10"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {raised.length === 0 ? (
              <div className="grid h-full place-items-center px-4 text-center text-xs text-white/50">
                Nenhum participante levantou a mão. Quando o fizerem, aparecem aqui para convidares para o palco.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {raised.map((p) => (
                  <li
                    key={p.userId}
                    className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-2.5 py-2 ring-1 ring-white/5"
                  >
                    <MemberAvatar
                      name={p.displayName}
                      avatarUrl={p.avatarUrl}
                      verified={adminIds.has(p.userId) || p.role === "host"}
                      size={36}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-white">{p.displayName}</div>
                      <div className="text-[10.5px] text-amber-300/80">Levantou a mão</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => actions.promoteToStage(p.userId, { role: "speaker" })}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1.5 text-[11px] font-semibold text-black hover:brightness-105"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Convidar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
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
