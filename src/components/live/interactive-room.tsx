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
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRoomState } from "@/hooks/use-room-state";
import type { RoomActions, RoomState, StageLayout } from "@/lib/room-state";
import { Stage } from "./stage";
import { Backstage } from "./backstage";
import { RoomControls } from "./room-controls";
import { Hand, Radio, X, UserPlus, Users, UserMinus, Volume2, ShieldCheck, ShieldOff } from "lucide-react";
import { MemberAvatar } from "@/components/mm/member-avatar";
import { useAdminIds } from "@/hooks/use-admin-ids";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import {
  goLive,
  endLive,
  raiseHand,
  leaveStage,
  leaveRoom,
  inviteToStage,
  promoteToStage,
  demoteFromStage,
  setSpotlight,
  setStageLayout,
  kickParticipant,
  banParticipant,
  setRole,
} from "@/lib/live-room.functions";

interface Props {
  liveId: string;
  localUserId: string;
  token: string;
  url: string;
  target: "backstage" | "main";
  onLeave?: () => void;
  onRetry?: () => void;
}

export function InteractiveRoom({ liveId, localUserId, token, url, target, onLeave, onRetry }: Props) {
  // ----- server RPC bindings -----
  const goLiveFn = useServerFn(goLive);
  const endLiveFn = useServerFn(endLive);
  const raiseHandFn = useServerFn(raiseHand);
  const leaveStageFn = useServerFn(leaveStage);
  const leaveRoomFn = useServerFn(leaveRoom);
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
      leaveStage: async () => {
        await leaveStageFn({ data: { liveId } });
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
        const result = await goLiveFn({ data: { liveId } });
        if (result.recordingWarning) toast.error("Gravação indisponível", { description: result.recordingWarning, duration: 12000 });
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
    [liveId, goLiveFn, endLiveFn, raiseHandFn, leaveStageFn, inviteFn, promoteFn, demoteFn, spotlightFn, layoutFn, kickFn, banFn],
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

  // Sair da sala: liberta o lugar no servidor (a contagem baixa em tempo real),
  // desliga o motor de vídeo e só depois navega.
  const handleLeave = useCallback(async () => {
    try {
      await leaveRoomFn({ data: { liveId } });
    } catch {
      /* melhor esforço — a navegação nunca deve ficar bloqueada */
    }
    try {
      await actions.leave();
    } catch {
      /* ignore */
    }
    onLeave?.();
  }, [leaveRoomFn, liveId, actions, onLeave]);

  // Fechar o separador / recarregar também liberta o lugar. Não chamar
  // leaveRoom no cleanup do componente: a mesma sala é desmontada durante
  // backstage → main e renovações de token. Esse cleanup chegava depois do
  // novo join e retirava novamente o host do palco.
  useEffect(() => {
    const release = () => {
      void leaveRoomFn({ data: { liveId } }).catch(() => {});
    };
    window.addEventListener("pagehide", release);
    return () => {
      window.removeEventListener("pagehide", release);
    };
  }, [leaveRoomFn, liveId]);


  // Força o desbloqueio do áudio remoto: tenta imediatamente e, se o browser
  // exigir gesto do utilizador, ao primeiro toque/clique/tecla.
  useEffect(() => {
    void actions.startAudio();
    if (!state.audioBlocked) return;
    const unlock = () => {
      void actions.startAudio();
    };
    const opts = { passive: true } as AddEventListenerOptions;
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("touchstart", unlock, opts);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [actions, state.audioBlocked, state.connection.state]);


  // Which stage to render?
  const inBackstage = target === "backstage";
  const isPublisher = state.localRole === "host" || state.localRole === "cohost" || state.localRole === "speaker";
  const audienceWaiting = !inBackstage && state.status !== "live" && state.status !== "ended";

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-col">
      {/* Connection indicator */}
      {state.connection.state !== "connected" && (
        <div className="absolute inset-x-0 top-0 z-30 flex justify-center pt-2">
          <div className="flex items-center gap-2 rounded-full bg-black/80 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md">
            <span className={state.connection.state === "disconnected" ? "h-1.5 w-1.5 rounded-full bg-red-400" : "h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400"} />
            {state.connection.state === "reconnecting"
              ? "A reconectar…"
              : state.connection.state === "disconnected"
                ? "Ligação interrompida"
                : "A conectar…"}
            {state.connection.state === "disconnected" && onRetry && (
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs text-white hover:bg-white/10 hover:text-white" onClick={onRetry}>
                Tentar novamente
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Áudio bloqueado pelo browser — exige um gesto do utilizador */}
      {state.audioBlocked && (
        <div className="absolute inset-x-0 top-10 z-30 flex justify-center px-3">
          <button
            type="button"
            onClick={() => void actions.startAudio()}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-black shadow-lg hover:brightness-105"
          >
            <Volume2 className="h-4 w-4" />
            Ativar som
          </button>
        </div>
      )}





      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
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

      {/* Reserved controls dock: never covers shared content or browser UI. */}
      <div className="pointer-events-none z-20 flex min-w-0 shrink-0 justify-center border-t border-white/5 bg-black px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5 sm:px-3">
        <RoomControls state={state} actions={actions} onLeave={() => void handleLeave()} />
      </div>
    </div>
  );
}

function HostRequestsPanel({ state, actions }: { state: RoomState; actions: RoomActions }) {
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [roleBusy, setRoleBusy] = useState<string | null>(null);
  const setRoleFn = useServerFn(setRole);
  const isHost = state.localRole === "host";
  const adminIds = useAdminIds();
  const onStage = useMemo(
    () =>
      state.participants.filter(
        (p) => p.onStage && !p.banned && p.role !== "host" && p.userId !== state.localUserId,
      ),
    [state.participants, state.localUserId],
  );
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
            <div className="text-sm font-semibold">Gestão do palco</div>
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
            {onStage.length > 0 && (
              <div className="mb-3">
                <div className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                  No palco · {onStage.length}
                </div>
                <ul className="space-y-1.5">
                  {onStage.map((p) => (
                    <li
                      key={p.userId}
                      className="rounded-xl bg-white/[0.03] px-2.5 py-2 ring-1 ring-white/5"
                    >
                      <div className="flex items-center gap-2">
                        <MemberAvatar
                          name={p.displayName}
                          avatarUrl={p.avatarUrl}
                          verified={adminIds.has(p.userId) || p.role === "host"}
                          size={36}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-white">{p.displayName}</div>
                          <div className="text-[10.5px] text-white/50">
                            {p.role === "cohost" ? "Co-host" : "Orador"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {isHost && (
                          <button
                            type="button"
                            disabled={roleBusy === p.userId}
                            onClick={async () => {
                              setRoleBusy(p.userId);
                              try {
                                await setRoleFn({
                                  data: {
                                    liveId: state.liveId,
                                    targetUserId: p.userId,
                                    role: p.role === "cohost" ? "speaker" : "cohost",
                                  },
                                });
                              } finally {
                                setRoleBusy(null);
                              }
                            }}
                            className={
                              p.role === "cohost"
                                ? "inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-white/80 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-50"
                                : "inline-flex items-center gap-1 rounded-lg bg-amber-400/15 px-2.5 py-1.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-400/30 transition hover:bg-amber-400/25 disabled:opacity-50"
                            }
                          >
                            {p.role === "cohost" ? (
                              <ShieldOff className="h-3.5 w-3.5" />
                            ) : (
                              <ShieldCheck className="h-3.5 w-3.5" />
                            )}
                            {roleBusy === p.userId
                              ? "A atualizar…"
                              : p.role === "cohost"
                                ? "Retirar co-host"
                                : "Tornar co-host"}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={removing === p.userId}
                          onClick={async () => {
                            setRemoving(p.userId);
                            try {
                              await actions.demoteFromStage(p.userId);
                            } finally {
                              setRemoving(null);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-white/80 ring-1 ring-white/10 transition hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                          {removing === p.userId ? "A remover…" : "Remover do palco"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Pedidos para participar
            </div>
            {raised.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-white/50">
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
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => actions.promoteToStage(p.userId, { role: "speaker" })}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1.5 text-[11px] font-semibold text-black hover:brightness-105"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Convidar
                      </button>
                      {isHost && (
                        <button
                          type="button"
                          onClick={() => actions.promoteToStage(p.userId, { role: "cohost" })}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-400/15 px-2.5 py-1.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-400/30 hover:bg-amber-400/25"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Como co-host
                        </button>
                      )}
                    </div>
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
