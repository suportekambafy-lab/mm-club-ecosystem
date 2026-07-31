/**
 * Floating controls bar (Meet-style). Pure UI reading abstract state.
 */
import { useMemo, useState } from "react";
import type { MediaDeviceOption, RoomActions, RoomState } from "@/lib/room-state";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, ScreenShare, Hand, PhoneOff, Layout, LogOut, ChevronUp } from "lucide-react";
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
  const isPublisher = local?.onStage || local?.micAllowed || local?.camAllowed || local?.screenAllowed;
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
            icon={local.micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-red-400" />}
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
            icon={local.camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4 text-red-400" />}
          />
          <DeviceMenu kind="videoinput" actions={actions} label="Escolher câmara" />
        </div>
      )}
      {isPublisher && canShareScreen && (
        canScreenShare ? (
          <IconButton
            active={local?.isScreenSharing}
            onClick={() =>
              run("screen", () =>
                local?.isScreenSharing ? actions.stopScreenShare() : actions.startScreenShare(),
              )
            }
            busy={busy === "screen"}
            label={local?.isScreenSharing ? "Parar partilha" : "Partilhar ecrã"}
            icon={<ScreenShare className={cn("h-4 w-4", local?.isScreenSharing && "text-emerald-400")} />}
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
        )
      )}

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
              toast.success("Saíste do palco", { description: "Continuas na sala como audiência." });
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
  const active = actions.getActiveDevice?.(kind);

  if (!actions.listDevices || !actions.setDevice) return null;

  const openMenu = async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setLoading(true);
    try {
      setDevices((await actions.listDevices!(kind)) ?? []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openMenu}
        aria-label={label}
        title={label}
        className="grid h-9 w-5 place-items-center rounded-lg text-white/60 hover:text-white"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 min-w-[220px] max-w-[280px] -translate-x-1/2 rounded-xl border border-white/10 bg-neutral-900/95 p-1 shadow-2xl backdrop-blur-md">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-white/40">
            {kind === "videoinput" ? "Câmara" : "Microfone"}
          </div>
          {loading && <div className="px-3 py-2 text-xs text-white/50">A procurar dispositivos…</div>}
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
                  await actions.setDevice!(kind, d.deviceId);
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
        </div>
      )}
    </div>
  );
}

function LayoutMenu({ state, actions }: { state: RoomState; actions: RoomActions }) {
  const [open, setOpen] = useState(false);
  const layouts: { key: RoomState["layout"]; label: string }[] = [
    { key: "auto", label: "Auto" },
    { key: "solo", label: "Solo" },
    { key: "host_guest", label: "Host + Convidado" },
    { key: "spotlight", label: "Destaque" },
    { key: "grid", label: "Grelha" },
  ];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-white/80 hover:bg-white/10"
        aria-label="Alterar layout"
        title={`Layout: ${state.layout}`}
      >
        <Layout className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 min-w-[180px] rounded-xl border border-white/10 bg-neutral-900/95 p-1 shadow-2xl backdrop-blur-md">
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
        </div>
      )}
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

  const doLeave = () => {
    setOpen(false);
    if (onLeave) onLeave();
    else void actions.leave();
  };

  const doEnd = async () => {
    setEnding(true);
    try {
      await actions.endLive();
      // endLive flips lives.status to "ended"; the live route reacts and
      // redirects everyone to the replay view. Still, close the room locally.
      if (onLeave) onLeave();
      else await actions.leave();
    } finally {
      setEnding(false);
      setConfirming(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="ml-1 h-9 rounded-xl bg-red-500 px-3 text-white hover:bg-red-500/90"
      >
        <PhoneOff className="mr-1 h-4 w-4" />
        Sair
      </Button>
      {open && !confirming && (
        <div className="absolute bottom-full right-0 mb-2 min-w-[220px] rounded-xl border border-white/10 bg-neutral-900/95 p-1 shadow-2xl backdrop-blur-md">
          <button
            type="button"
            onClick={doLeave}
            className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-white/10"
          >
            <span className="text-sm text-white">Sair da sala</span>
            <span className="text-[11px] text-white/50">A live continua ativa para os restantes.</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-0.5 flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-red-500/10"
          >
            <span className="text-sm text-red-400">Terminar live</span>
            <span className="text-[11px] text-white/50">Encerra a sala para todos e finaliza a gravação.</span>
          </button>
        </div>
      )}
      {open && confirming && (
        <div className="absolute bottom-full right-0 mb-2 w-[280px] rounded-xl border border-white/10 bg-neutral-900/95 p-3 shadow-2xl backdrop-blur-md">
          <div className="text-sm font-medium text-white">Terminar a live para todos?</div>
          <p className="mt-1 text-[12px] text-white/60">
            Todos os participantes serão desligados. A gravação é finalizada e o replay ficará disponível assim que estiver pronto.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={ending}
              className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={doEnd}
              disabled={ending}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500/90 disabled:opacity-50"
            >
              {ending ? "A terminar…" : "Terminar live"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

