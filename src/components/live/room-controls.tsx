/**
 * Floating controls bar (Meet-style). Pure UI reading abstract state.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import type { MediaDeviceOption, RoomActions, RoomState } from "@/lib/room-state";
import { Button } from "@/components/ui/button";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  Hand,
  PhoneOff,
  Layout,
  LogOut,
  ChevronUp,
  Circle,
} from "lucide-react";
import { getRecordingState, startRecordingNow, stopRecordingNow } from "@/lib/live-room.functions";
import { StudioPanel } from "./studio-panel";
import { cn } from "@/lib/utils";
import { toast } from "sonner";


// getDisplayMedia is not implemented on mobile browsers (iOS Safari,
// Chrome Android, etc.). Detect once so we can show a helpful hint
// instead of firing a hard error when the user taps the button.
const canScreenShare =
  typeof navigator !== "undefined" &&
  typeof navigator.mediaDevices !== "undefined" &&
  typeof navigator.mediaDevices.getDisplayMedia === "function";

interface Props {
  state: RoomState;
  actions: RoomActions;
  onLeave?: () => void;
}

export function RoomControls({ state, actions, onLeave }: Props) {
  const local = useMemo(
    () => state.participants.find((p) => p.userId === state.localUserId),
    [state.participants, state.localUserId],
  );
  const [busy, setBusy] = useState<string | null>(null);
  const isPublisher =
    local?.onStage || local?.micAllowed || local?.camAllowed || local?.screenAllowed;
  // Screen share never depends on having a camera: anyone on stage can share.
  const canShareScreen = Boolean(local?.screenAllowed || local?.onStage);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="pointer-events-auto flex max-w-full items-center justify-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-neutral-950 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {isPublisher && local?.micAllowed && (
        <div className="flex shrink-0 items-center">
          <IconButton
            active={local.micOn}
            onClick={() => run("mic", actions.toggleMic)}
            busy={busy === "mic"}
            label={local.micOn ? "Silenciar microfone" : "Ativar microfone"}
            icon={
              local.micOn ? (
                <Mic className="h-4 w-4" />
              ) : (
                <MicOff className="h-4 w-4 text-red-400" />
              )
            }
          />
          <DeviceMenu kind="audioinput" actions={actions} label="Escolher microfone" />
        </div>
      )}
      {isPublisher && local?.camAllowed && (
        <div className="flex shrink-0 items-center">
          <IconButton
            active={local.camOn}
            onClick={() => run("cam", actions.toggleCam)}
            busy={busy === "cam"}
            label={local.camOn ? "Desligar câmara" : "Ligar câmara"}
            icon={
              local.camOn ? (
                <Video className="h-4 w-4" />
              ) : (
                <VideoOff className="h-4 w-4 text-red-400" />
              )
            }
          />
          <DeviceMenu kind="videoinput" actions={actions} label="Escolher câmara" />
        </div>
      )}
      {isPublisher &&
        canShareScreen &&
        (canScreenShare ? (
          <IconButton
            active={local?.isScreenSharing}
            onClick={() =>
              run("screen", () =>
                local?.isScreenSharing ? actions.stopScreenShare() : actions.startScreenShare(),
              )
            }
            busy={busy === "screen"}
            label={local?.isScreenSharing ? "Parar partilha" : "Partilhar ecrã"}
            icon={
              <ScreenShare
                className={cn("h-4 w-4", local?.isScreenSharing && "text-emerald-400")}
              />
            }
          />
        ) : (
          <IconButton
            active={false}
            onClick={() =>
              toast.info("Partilha de ecrã indisponível no telemóvel", {
                description:
                  "Esta funcionalidade só está disponível em computador. Abre a sala num browser desktop para partilhar o teu ecrã.",
                duration: 5000,
              })
            }
            label="Partilha de ecrã disponível apenas em computador"
            icon={<ScreenShare className="h-4 w-4 text-white/40" />}
          />
        ))}

      {isPublisher && <StudioPanel />}

      {!isPublisher && (
        <IconButton
          active={Boolean(local?.handRaisedAt)}
          onClick={() => run("hand", () => actions.raiseHand(!local?.handRaisedAt))}
          busy={busy === "hand"}
          label={local?.handRaisedAt ? "Baixar a mão" : "Levantar a mão"}
          icon={<Hand className={cn("h-4 w-4", local?.handRaisedAt && "text-amber-400")} />}
        />
      )}

      {/* Self-service stage exit — anyone on stage except the host. */}
      {isPublisher && state.localRole !== "host" && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            run("leaveStage", async () => {
              try {
                if (local?.isScreenSharing) await actions.stopScreenShare();
              } catch {
                /* ignore */
              }
              await actions.leaveStage();
              toast.success("Saíste do palco", {
                description: "Continuas na sala como audiência.",
              });
            })
          }
          disabled={busy === "leaveStage"}
          className="h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-white/85 hover:bg-white/10"
        >
          <LogOut className="mr-1 h-4 w-4" />
          <span className="hidden sm:inline">Sair do palco</span>
        </Button>
      )}

      {(state.localRole === "host" || state.localRole === "cohost") && (
        <RecordButton liveId={state.liveId} isLive={state.status === "live"} />
      )}

      {(state.localRole === "host" || state.localRole === "cohost") && (
        <LayoutMenu state={state} actions={actions} />
      )}


      {state.localRole === "host" ? (
        <HostLeaveMenu state={state} actions={actions} onLeave={onLeave} />
      ) : (
        <Button
          variant="destructive"
          size="sm"
          onClick={onLeave ?? (() => actions.leave())}
          className="ml-1 h-9 rounded-xl bg-red-500 px-3 text-white hover:bg-red-500/90"
        >
          <PhoneOff className="mr-1 h-4 w-4" />
          Sair
        </Button>
      )}
    </div>
  );
}

/**
 * Host/cohost recording control. The server starts recording automatically on
 * "Ir ao ar"; this button shows the real egress state (polled) and lets the
 * host retomar/parar a gravação manualmente.
 */
function RecordButton({ liveId, isLive }: { liveId: string; isLive: boolean }) {
  const statusFn = useServerFn(getRecordingState);
  const startFn = useServerFn(startRecordingNow);
  const stopFn = useServerFn(stopRecordingNow);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await statusFn({ data: { liveId } });
      setRecording(Boolean(r?.recording));
      setStarting(Boolean(r?.starting));
    } catch {
      /* ignore */
    }
  }, [statusFn, liveId]);

  useEffect(() => {
    if (!isLive) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(id);
  }, [isLive, refresh]);

  if (!isLive) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      if (recording) {
        const r = await stopFn({ data: { liveId } });
        if (r?.ok) {
          setRecording(false);
          toast.success("Gravação parada", {
            description: "O replay será preparado com o que já foi gravado.",
          });
        } else {
          toast.error("Não foi possível parar a gravação");
        }
      } else {
        const r = await startFn({ data: { liveId } });
        if (r?.ok) {
          setRecording(true);
          toast.success("A gravar", { description: "A sessão está a ser gravada para replay." });
        } else {
          toast.error("Não foi possível iniciar a gravação", {
            description: r?.reason ?? "Tenta novamente em alguns segundos.",
          });
        }
      }
    } catch {
      toast.error("Erro no controlo da gravação");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => void toggle()}
      disabled={busy}
      title={recording ? "Parar gravação" : "Gravar a sessão"}
      aria-label={recording ? "Parar gravação" : "Gravar a sessão"}
      className={cn(
        "h-9 shrink-0 rounded-xl border px-3 text-xs",
        recording
          ? "border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25"
          : "border-white/10 bg-white/5 text-white/85 hover:bg-white/10",
      )}
    >
      {recording ? (
        <span className="mr-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-400" />
      ) : (
        <Circle className="mr-1.5 h-4 w-4" />
      )}
      <span className="hidden sm:inline">
        {busy ? "…" : recording ? (starting ? "A iniciar…" : "A gravar") : "Gravar"}
      </span>
    </Button>
  );
}

function IconButton({

  active,
  onClick,
  busy,
  label,
  icon,
}: {
  active?: boolean;
  onClick: () => void;
  busy?: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-xl transition-colors",
        active ? "bg-white/10 text-white" : "bg-white/5 text-white/80 hover:bg-white/10",
        busy && "opacity-60",
      )}
    >
      {icon}
    </button>
  );
}

function DeviceMenu({
  kind,
  actions,
  label,
}: {
  kind: "videoinput" | "audioinput";
  actions: RoomActions;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const active = actions.getActiveDevice?.(kind);

  if (!actions.listDevices || !actions.setDevice) return null;

  const openMenu = async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setLoading(true);
    try {
      const listDevices = actions.listDevices;
      if (!listDevices) return;
      setDevices((await listDevices(kind)) ?? []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={anchorRef}
        type="button"
        onClick={openMenu}
        aria-label={label}
        title={label}
        className="grid h-9 w-5 place-items-center rounded-lg text-white/60 hover:text-white"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <AnchoredMenu open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} width={240}>
        <>
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-white/40">
            {kind === "videoinput" ? "Câmara" : "Microfone"}
          </div>
          {loading && (
            <div className="px-3 py-2 text-xs text-white/50">A procurar dispositivos…</div>
          )}
          {!loading && devices.length === 0 && (
            <div className="px-3 py-2 text-xs text-white/50">Nenhum dispositivo encontrado.</div>
          )}
          {devices.map((d) => (
            <button
              key={d.deviceId}
              type="button"
              onClick={async () => {
                setOpen(false);
                try {
                  const setDevice = actions.setDevice;
                  if (!setDevice) return;
                  await setDevice(kind, d.deviceId);
                  toast.success(kind === "videoinput" ? "Câmara alterada" : "Microfone alterado", {
                    description: d.label,
                  });
                } catch {
                  toast.error("Não foi possível mudar de dispositivo");
                }
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10",
                active === d.deviceId && "bg-white/10 text-white",
              )}
            >
              <span className="truncate">{d.label}</span>
              {active === d.deviceId && <span className="text-[hsl(45_86%_60%)]">•</span>}
            </button>
          ))}
        </>
      </AnchoredMenu>
    </div>
  );
}

function LayoutMenu({ state, actions }: { state: RoomState; actions: RoomActions }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const layouts: { key: RoomState["layout"]; label: string }[] = [
    { key: "auto", label: "Auto" },
    { key: "solo", label: "Solo" },
    { key: "host_guest", label: "Host + Convidado" },
    { key: "spotlight", label: "Destaque" },
    { key: "grid", label: "Grelha" },
  ];
  return (
    <div className="relative shrink-0">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-white/80 hover:bg-white/10"
        aria-label="Alterar layout"
        title={`Layout: ${state.layout}`}
      >
        <Layout className="h-4 w-4" />
      </button>
      <AnchoredMenu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        align="right"
        width={200}
      >
        <>
          {layouts.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => {
                actions.setLayout(l.key);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10",
                state.layout === l.key && "bg-white/10 text-white",
              )}
            >
              {l.label}
              {state.layout === l.key && <span className="text-[hsl(45_86%_60%)]">•</span>}
            </button>
          ))}
        </>
      </AnchoredMenu>
    </div>
  );
}

/**
 * Host-only leave menu. Distinguishes "leave the room" (host disconnects but
 * the live keeps running — auto-transfer / co-host takes over) from "end the
 * live for everyone" (calls endLive → egress stops, replay is prepared, all
 * viewers are redirected).
 */
function HostLeaveMenu({
  state,
  actions,
  onLeave,
}: {
  state: RoomState;
  actions: RoomActions;
  onLeave?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [ending, setEnding] = useState(false);
  const anchorRef = useRef<HTMLButtonElement | null>(null);

  const closeMenu = () => {
    if (ending) return;
    setOpen(false);
    setConfirming(false);
  };

  const doLeave = () => {
    setOpen(false);
    if (onLeave) onLeave();
    else void actions.leave();
  };

  const doEnd = async () => {
    setEnding(true);
    try {
      try {
        await actions.endLive();
      } catch (first) {
        // Sessões longas expiram o token: renova e tenta uma segunda vez antes
        // de desistir — sem isto o botão "Terminar live" parecia não funcionar.
        const { supabase } = await import("@/integrations/supabase/client");
        await supabase.auth.refreshSession().catch(() => {});
        await actions.endLive();
      }
      // endLive flips lives.status to "ended"; the live route reacts and
      // redirects everyone to the replay view. Still, close the room locally.
      if (onLeave) onLeave();
      else await actions.leave();
    } catch (err) {
      console.error("[room-controls] endLive failed", err);
      toast.error("Não foi possível terminar a live", {
        description: err instanceof Error ? err.message : "Tenta novamente.",
      });
    } finally {
      setEnding(false);
      setConfirming(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Button
        ref={anchorRef}
        variant="destructive"
        size="sm"
        onClick={() => {
          setConfirming(false);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="ml-1 h-9 rounded-xl bg-red-500 px-3 text-white hover:bg-red-500/90"
      >
        <PhoneOff className="mr-1 h-4 w-4" />
        Sair
      </Button>
      <AnchoredMenu open={open} onClose={closeMenu} anchorRef={anchorRef} align="right" width={280}>
        {!confirming ? (
          <div role="dialog" aria-label="Opções para sair da live">
            <Button
              variant="ghost"
              onClick={doLeave}
              className="h-auto w-full flex-col items-start gap-0.5 whitespace-normal px-3 py-2 text-left text-white hover:bg-white/10 hover:text-white"
            >
              <span className="text-sm">Sair apenas da sala</span>
              <span className="text-[11px] font-normal text-white/50">
                A live continua ativa para os restantes.
              </span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirming(true)}
              className="mt-0.5 h-auto w-full flex-col items-start gap-0.5 whitespace-normal px-3 py-2 text-left text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <span className="text-sm">Terminar live para todos</span>
              <span className="text-[11px] font-normal text-white/50">
                Encerra a sala e finaliza a gravação.
              </span>
            </Button>
          </div>
        ) : (
          <div
            role="alertdialog"
            aria-labelledby="end-live-title"
            aria-describedby="end-live-description"
            className="p-2"
          >
            <div id="end-live-title" className="text-sm font-medium text-white">
              Terminar a live para todos?
            </div>
            <p id="end-live-description" className="mt-1 text-[12px] text-white/60">
              Todos os participantes serão desligados. A gravação é finalizada e o replay ficará
              disponível assim que estiver pronto.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={ending}
                className="bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={doEnd}
                disabled={ending}
                className="bg-red-500 text-white hover:bg-red-500/90"
              >
                {ending ? "A terminar…" : "Terminar live"}
              </Button>
            </div>
          </div>
        )}
      </AnchoredMenu>
    </div>
  );
}

/**
 * Dropdown rendered in a portal, anchored above its trigger.
 *
 * The controls bar uses `overflow-x-auto` (so it can scroll on mobile), which
 * clips any absolutely-positioned child. Rendering the menu in a portal with
 * fixed coordinates keeps it visible and clickable.
 */
function AnchoredMenu({
  open,
  onClose,
  anchorRef,
  children,
  align = "center",
  width = 220,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  align?: "center" | "right";
  width?: number;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => setRect(anchorRef.current?.getBoundingClientRect() ?? null);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const node = e.target as Node;
      if (anchorRef.current?.contains(node)) return;
      if ((node as HTMLElement)?.closest?.("[data-anchored-menu]")) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || typeof document === "undefined" || !rect) return null;

  const left =
    align === "right"
      ? Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8)
      : Math.min(
          Math.max(8, rect.left + rect.width / 2 - width / 2),
          window.innerWidth - width - 8,
        );

  return createPortal(
    <div
      data-anchored-menu
      style={{
        position: "fixed",
        left,
        bottom: Math.max(8, window.innerHeight - rect.top + 8),
        width,
      }}
      className="z-[100] max-h-[60vh] overflow-y-auto rounded-xl border border-white/10 bg-neutral-900/95 p-1 shadow-2xl backdrop-blur-md"
    >
      {children}
    </div>,
    document.body,
  );
}
