/**
 * Floating controls bar (Meet-style). Pure UI reading abstract state.
 */
import { useMemo, useState } from "react";
import type { RoomActions, RoomState } from "@/lib/room-state";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, ScreenShare, Hand, PhoneOff, Layout } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const isPublisher = local?.onStage || local?.micAllowed || local?.camAllowed;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-white/10 bg-black/60 p-1.5 backdrop-blur-md">
      {isPublisher && local?.micAllowed && (
        <IconButton
          active={local.micOn}
          onClick={() => run("mic", actions.toggleMic)}
          busy={busy === "mic"}
          label={local.micOn ? "Silenciar microfone" : "Ativar microfone"}
          icon={local.micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-red-400" />}
        />
      )}
      {isPublisher && local?.camAllowed && (
        <IconButton
          active={local.camOn}
          onClick={() => run("cam", actions.toggleCam)}
          busy={busy === "cam"}
          label={local.camOn ? "Desligar câmara" : "Ligar câmara"}
          icon={local.camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4 text-red-400" />}
        />
      )}
      {isPublisher && local?.screenAllowed && (
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
      )}

      {!isPublisher && (
        <IconButton
          active={Boolean(local?.handRaisedAt)}
          onClick={() => run("hand", () => actions.raiseHand(!local?.handRaisedAt))}
          busy={busy === "hand"}
          label={local?.handRaisedAt ? "Baixar a mão" : "Levantar a mão"}
          icon={<Hand className={cn("h-4 w-4", local?.handRaisedAt && "text-amber-400")} />}
        />
      )}

      {(state.localRole === "host" || state.localRole === "cohost") && (
        <LayoutMenu state={state} actions={actions} />
      )}

      <Button
        variant="destructive"
        size="sm"
        onClick={onLeave ?? (() => actions.leave())}
        className="ml-1 h-9 rounded-xl bg-red-500 px-3 text-white hover:bg-red-500/90"
      >
        <PhoneOff className="mr-1 h-4 w-4" />
        Sair
      </Button>
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
