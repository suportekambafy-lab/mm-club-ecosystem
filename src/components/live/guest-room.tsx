/**
 * <GuestRoom> — minimal LiveKit room for external guests (no MM Club account).
 *
 * Guests join as regular attendees (audience). They can raise their hand and,
 * once the host promotes them, the room reconnects with publish rights.
 *
 * Self-contained on purpose: guests have no Supabase session, so this view
 * reads everything from the LiveKit room itself (participants, tracks) rather
 * than from Postgres like the member experience does.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteTrackPublication,
} from "livekit-client";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2, Hand, Volume2, MessagesSquare, X, MonitorUp, MonitorOff } from "lucide-react";
import { toast } from "sonner";
import { GuestChat } from "@/components/live/guest-chat";
import { HQ_ROOM_OPTIONS } from "@/lib/livekit-quality";
import { cn } from "@/lib/utils";
import { guestSync, guestLeave } from "@/lib/live-guest.functions";
import type { MediaPrefs } from "@/lib/media-prefs";

interface Props {
  token: string;
  url: string;
  prefs: MediaPrefs;
  /** Identity + credentials used to poll for stage promotions. */
  liveId: string;
  code: string;
  guestId: string;
  displayName: string;
  onStage: boolean;
  onLeave: () => void;
}

/**
 * Liga a câmara do convidado com tentativas progressivas: dispositivo escolhido,
 * 720p, 360p e por fim as predefinições. Devolve uma mensagem legível em caso
 * de falha (permissão, câmara ocupada, sem câmara).
 */
async function enableGuestCamera(room: Room, deviceId?: string): Promise<string | null> {
  const lp = room.localParticipant;
  const attempts: Array<Record<string, unknown> | undefined> = [
    deviceId ? { deviceId } : undefined,
    { resolution: { width: 1280, height: 720 } },
    { resolution: { width: 640, height: 360 } },
    undefined,
  ];
  let lastErr: unknown = null;
  for (const opts of attempts) {
    try {
      await lp.setCameraEnabled(true, opts as never);
      if (lp.isCameraEnabled) return null;
    } catch (err) {
      lastErr = err;
    }
  }
  const msg = lastErr instanceof Error ? `${lastErr.name}: ${lastErr.message}` : String(lastErr ?? "");
  if (/NotAllowedError|Permission/i.test(msg)) {
    return "Permissão de câmara bloqueada. Autoriza no ícone da barra de endereço e tenta de novo.";
  }
  if (/NotReadableError|TrackStartError|could not start/i.test(msg)) {
    return "A câmara está a ser usada por outra aplicação. Fecha-a e tenta de novo.";
  }
  if (/NotFoundError|DevicesNotFound|OverconstrainedError/i.test(msg)) {
    return "Não encontrámos nenhuma câmara disponível neste dispositivo.";
  }
  return "Não foi possível ligar a câmara. Tenta de novo.";
}



export function GuestRoom({
  token,
  url,
  prefs,
  liveId,
  code,
  guestId,
  displayName,
  onStage: initialOnStage,
  onLeave,
}: Props) {
  const sync = useServerFn(guestSync);
  const leaveFn = useServerFn(guestLeave);
  const roomRef = useRef<Room | null>(null);
  /** True quando é o próprio convidado a sair (não tentamos reconectar). */
  const leavingRef = useRef(false);

  const [room, setRoom] = useState<Room | null>(null);
  const [activeToken, setActiveToken] = useState(token);
  const [onStage, setOnStage] = useState(initialOnStage);
  const [handRaised, setHandRaised] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(prefs.micEnabled && initialOnStage);
  const [camOn, setCamOn] = useState(prefs.camEnabled && initialOnStage);
  const [screenOn, setScreenOn] = useState(false);
  const [tick, forceTick] = useState(0);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);


  const unlockAudio = useCallback(async () => {
    const r = roomRef.current;
    if (!r) return;
    try {
      await r.startAudio();
    } catch {
      /* precisa de gesto do utilizador */
    }
    setAudioBlocked(!r.canPlaybackAudio);
  }, []);

  // Força o desbloqueio do áudio remoto ao primeiro gesto do utilizador.
  useEffect(() => {
    if (!audioBlocked) return;
    const unlock = () => void unlockAudio();
    const opts = { passive: true } as AddEventListenerOptions;
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("touchstart", unlock, opts);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [audioBlocked, unlockAudio]);

  const onStageRef = useRef(onStage);
  onStageRef.current = onStage;

  // Heartbeat: pick up promotions/demotions decided by the host.
  const poll = useCallback(
    async (raiseHand?: boolean) => {
      try {
        const r = await sync({
          data: { liveId, code, guestId, displayName, raiseHand, currentlyOnStage: onStageRef.current },
        });
        setHandRaised(r.handRaised);
        if (r.token) {
          setOnStage(r.onStage);
          setActiveToken(r.token);
        }
      } catch {
        /* transient — next tick retries */
      }
    },
    [sync, liveId, code, guestId, displayName],
  );

  useEffect(() => {
    const id = setInterval(() => void poll(), 5000);
    return () => clearInterval(id);
  }, [poll]);

  // Free the seat when the guest closes the tab / navigates away, so the host
  // does not see ghost or duplicated participants.
  const markLeft = useCallback(() => {
    void leaveFn({ data: { liveId, code, guestId } }).catch(() => {});
  }, [leaveFn, liveId, code, guestId]);

  useEffect(() => {
    const handler = () => markLeft();
    window.addEventListener("pagehide", handler);
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("pagehide", handler);
      window.removeEventListener("beforeunload", handler);
      markLeft();
    };
  }, [markLeft]);


  useEffect(() => {
    let cancelled = false;
    const r = new Room(HQ_ROOM_OPTIONS);
    roomRef.current = r;

    const rerender = () => forceTick((n) => n + 1);
    // Depois de reconectar, o servidor pode não voltar a enviar as pistas — sem
    // isto o convidado ficava sem ver/ouvir até fazer refresh.
    const resubscribeAll = () => {
      r.remoteParticipants.forEach((p) => {
        p.trackPublications.forEach((pub) => {
          try {
            (pub as RemoteTrackPublication).setSubscribed?.(true);
          } catch {
            /* já subscrito */
          }
        });
      });
      void r.startAudio().catch(() => {});
      setAudioBlocked(!r.canPlaybackAudio);
      rerender();
    };

    r.on(RoomEvent.ParticipantConnected, rerender)
      .on(RoomEvent.ParticipantDisconnected, rerender)
      .on(RoomEvent.TrackSubscribed, rerender)
      .on(RoomEvent.TrackUnsubscribed, rerender)
      .on(RoomEvent.TrackMuted, rerender)
      .on(RoomEvent.TrackUnmuted, rerender)
      .on(RoomEvent.LocalTrackPublished, rerender)
      .on(RoomEvent.LocalTrackUnpublished, rerender)
      .on(RoomEvent.ActiveSpeakersChanged, rerender)
      .on(RoomEvent.ConnectionStateChanged, rerender)
      .on(RoomEvent.Reconnecting, () => {
        setReconnecting(true);
        rerender();
      })
      .on(RoomEvent.Reconnected, () => {
        setReconnecting(false);
        resubscribeAll();
      })
      .on(RoomEvent.SignalConnected, resubscribeAll)
      .on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioBlocked(!r.canPlaybackAudio))
      .on(RoomEvent.Disconnected, () => {
        if (cancelled) return;
        if (leavingRef.current) {
          onLeave();
          return;
        }
        // Queda inesperada: voltamos a ligar sozinhos, sem refresh manual.
        setReconnecting(true);
        window.setTimeout(() => {
          if (!cancelled && !leavingRef.current) setReconnectNonce((n) => n + 1);
        }, 1200);
      });

    (async () => {
      try {
        setConnecting(true);
        await r.connect(url, activeToken);
        if (cancelled) return;
        setReconnecting(false);
        if (onStageRef.current) {
          if (prefs.micEnabled)
            await r.localParticipant
              .setMicrophoneEnabled(true, prefs.micId ? { deviceId: prefs.micId } : undefined)
              .catch(() => r.localParticipant.setMicrophoneEnabled(true).catch(() => {}));
          if (prefs.camEnabled) await enableGuestCamera(r, prefs.cameraId);
          setMicOn(r.localParticipant.isMicrophoneEnabled);
          setCamOn(r.localParticipant.isCameraEnabled);
        } else {
          setMicOn(false);
          setCamOn(false);
        }
        if (!cancelled) {
          setRoom(r);
          setConnecting(false);
          try {
            await r.startAudio();
          } catch {
            /* precisa de gesto */
          }
          setAudioBlocked(!r.canPlaybackAudio);
          resubscribeAll();
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Não foi possível entrar na sala.");
        setConnecting(false);
      }
    })();

    return () => {
      cancelled = true;
      r.disconnect().catch(() => {});
      roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeToken, url, reconnectNonce]);

  // Reconexão proativa quando a rede volta ou a app regressa ao primeiro plano.
  useEffect(() => {
    const check = () => {
      const r = roomRef.current;
      if (!r || leavingRef.current) return;
      if (r.state === "disconnected") setReconnectNonce((n) => n + 1);
      else {
        void r.startAudio().catch(() => {});
        setAudioBlocked(!r.canPlaybackAudio);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const participants: Participant[] = useMemo(() => {
    if (!room) return [];
    const all = [room.localParticipant as Participant, ...Array.from(room.remoteParticipants.values())];
    // Guard against duplicate identities (stale sessions reconnecting).
    const seen = new Set<string>();
    return all.filter((p) => {
      if (seen.has(p.identity)) return false;
      seen.add(p.identity);
      return true;
    });
    // `tick` força o recálculo a cada evento do LiveKit (entradas, pistas, mute).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, tick]);

  // O estado dos botões segue sempre o estado real do LiveKit — nunca fica
  // dessincronizado quando uma tentativa de ligar a câmara falha.
  useEffect(() => {
    const lp = roomRef.current?.localParticipant;
    if (!lp) return;
    setMicOn(lp.isMicrophoneEnabled);
    setCamOn(lp.isCameraEnabled);
    setScreenOn(lp.isScreenShareEnabled);
  }, [tick]);

  const toggleMic = async () => {
    const r = roomRef.current;
    if (!r) return;
    const lp = r.localParticipant;
    const next = !lp.isMicrophoneEnabled;
    try {
      await lp.setMicrophoneEnabled(next);
    } catch {
      try {
        await lp.setMicrophoneEnabled(next, undefined);
      } catch {
        toast.error("Não foi possível ligar o microfone. Verifica as permissões do navegador.");
      }
    }
    setMicOn(lp.isMicrophoneEnabled);
  };
  const toggleCam = async () => {
    const r = roomRef.current;
    if (!r) return;
    const lp = r.localParticipant;
    if (lp.isCameraEnabled) {
      await lp.setCameraEnabled(false).catch(() => {});
      setCamOn(lp.isCameraEnabled);
      return;
    }
    const err = await enableGuestCamera(r, prefs.cameraId);
    if (err) toast.error(err);
    setCamOn(lp.isCameraEnabled);
  };
  const toggleScreen = async () => {
    const r = roomRef.current;
    if (!r) return;
    const lp = r.localParticipant;
    if (lp.isScreenShareEnabled) {
      await lp.setScreenShareEnabled(false).catch(() => {});
      setScreenOn(lp.isScreenShareEnabled);
      return;
    }
    const attempt = async () => {
      try {
        await lp.setScreenShareEnabled(true, { audio: true });
        return null;
      } catch (err) {
        // Alguns browsers falham quando pedimos áudio do ecrã: tenta só vídeo.
        try {
          await lp.setScreenShareEnabled(true, { audio: false });
          return null;
        } catch {
          return err;
        }
      }
    };
    let err = await attempt();
    const msg = err instanceof Error ? err.message : String(err ?? "");
    if (err && /insufficient|not allowed to publish|permission denied by server/i.test(msg)) {
      // O token pode estar desatualizado (acabámos de subir ao palco): pede um
      // novo ao servidor e tenta outra vez sem obrigar a refresh.
      await poll();
      await new Promise((res) => setTimeout(res, 600));
      err = await attempt();
    }
    if (err) {
      const m = err instanceof Error ? err.message : String(err);
      if (/NotAllowedError|cancel|Permission denied by system/i.test(m)) {
        toast.error("Partilha de ecrã cancelada ou bloqueada pelo navegador.");
      } else if (/insufficient|not allowed to publish/i.test(m)) {
        toast.error("O anfitrião ainda não autorizou a tua partilha de ecrã.");
      } else {
        toast.error("Não foi possível partilhar o ecrã neste dispositivo.");
      }
    }
    setScreenOn(lp.isScreenShareEnabled);
  };


  useEffect(() => {
    if (!onStage && screenOn) setScreenOn(false);
  }, [onStage, screenOn]);





  if (connecting) {
    return (
      <div className="grid h-full w-full place-items-center bg-black text-white/70">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> A entrar na sala…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid h-full w-full place-items-center bg-black p-6 text-center text-white">
        <div className="max-w-sm">
          <p className="text-sm text-red-300">{error}</p>
          <button
            type="button"
            onClick={onLeave}
            className="mt-4 rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/5"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const screenSharer = participants.find((p) => {
    const publication = p.getTrackPublication(Track.Source.ScreenShare);
    return Boolean(publication?.track && !(publication as RemoteTrackPublication).isMuted);
  });
  const cameraParticipants = screenSharer
    ? participants.filter((p) => p.identity !== screenSharer.identity)
    : participants;
  const screenSharerHasCamera = Boolean(
    screenSharer?.getTrackPublication(Track.Source.Camera)?.track,
  );
  const cols = participants.length <= 1 ? 1 : participants.length <= 4 ? 2 : 3;

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-black">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {screenSharer ? (
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-black">
          <GuestTile
            participant={screenSharer}
            isLocal={screenSharer.identity === room?.localParticipant.identity}
            preferScreen
            className="absolute inset-0 h-full w-full rounded-none ring-0"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-[clamp(68px,20%,96px)] flex-row gap-2 overflow-x-auto bg-gradient-to-t from-black/80 to-transparent p-2 pt-3 [scrollbar-width:none] sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-0 sm:h-auto sm:max-h-full sm:w-[clamp(120px,16vw,180px)] sm:flex-col sm:overflow-y-auto sm:bg-gradient-to-l sm:pl-3 [&::-webkit-scrollbar]:hidden">
            {screenSharerHasCamera && (
              <GuestTile
                participant={screenSharer}
                isLocal={screenSharer.identity === room?.localParticipant.identity}
                cameraOnly
                className="aspect-video h-full shrink-0 shadow-2xl ring-2 ring-amber-400 sm:h-auto sm:w-full"
              />
            )}
            {cameraParticipants.map((p) => (
              <GuestTile
                key={p.identity}
                participant={p}
                isLocal={p.identity === room?.localParticipant.identity}
                cameraOnly
                className="aspect-video h-full shrink-0 shadow-2xl sm:h-auto sm:w-full"
              />
            ))}
          </div>
        </div>
      ) : (
        <div
          className="grid min-h-0 flex-1 gap-2 overflow-hidden p-2"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {participants.map((p) => (
            <GuestTile key={p.identity} participant={p} isLocal={p.identity === room?.localParticipant.identity} />
          ))}
        </div>
      )}

      {!onStage && (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
          <div className="rounded-full bg-black/70 px-3 py-1.5 text-[11px] text-white/70 ring-1 ring-white/10 backdrop-blur-md">
            Estás a assistir como convidado. Levanta a mão para pedires para falar.
          </div>
        </div>
      )}

      {audioBlocked && (
        <div className="absolute inset-x-0 top-12 z-30 flex justify-center px-3">
          <button
            type="button"
            onClick={() => void unlockAudio()}
            className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-black shadow-lg hover:brightness-105"
          >
            <Volume2 className="h-4 w-4" />
            Ativar som
          </button>
        </div>
      )}



      </div>

      {chatOpen && (
        <div className="absolute inset-x-0 bottom-0 z-40 h-[52%] min-h-0 border-t border-white/10 bg-black/95 backdrop-blur-md lg:static lg:z-auto lg:h-auto lg:w-[340px] lg:shrink-0 lg:border-l lg:border-t-0">
          <button
            type="button"
            onClick={() => setChatOpen(false)}
            aria-label="Fechar chat"
            className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
          <GuestChat liveId={liveId} code={code} guestId={guestId} displayName={displayName} />
        </div>
      )}
      </div>

      <div className="pointer-events-none shrink-0 border-t border-white/5 bg-black px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5">
        <div className="pointer-events-auto flex max-w-full items-center gap-2 overflow-x-auto rounded-full bg-black/70 px-3 py-2 ring-1 ring-white/10 backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {onStage ? (
            <>
              <button
                type="button"
                onClick={toggleMic}
                aria-label={micOn ? "Desligar microfone" : "Ligar microfone"}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-full text-white transition",
                  micOn ? "bg-white/10 hover:bg-white/20" : "bg-red-500/90 hover:bg-red-500",
                )}
              >
                {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={toggleCam}
                aria-label={camOn ? "Desligar câmara" : "Ligar câmara"}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-full text-white transition",
                  camOn ? "bg-white/10 hover:bg-white/20" : "bg-red-500/90 hover:bg-red-500",
                )}
              >
                {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={toggleScreen}
                aria-label={screenOn ? "Parar partilha de ecrã" : "Partilhar ecrã"}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-full text-white transition",
                  screenOn ? "bg-[hsl(45_86%_60%)]/90 text-black hover:bg-[hsl(45_86%_60%)]" : "bg-white/10 hover:bg-white/20",
                )}
              >
                {screenOn ? <MonitorOff className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void poll(!handRaised)}
              aria-label={handRaised ? "Baixar a mão" : "Levantar a mão"}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition",
                handRaised ? "bg-amber-400 text-black hover:brightness-105" : "bg-white/10 text-white hover:bg-white/20",
              )}
            >
              <Hand className="h-4 w-4" />
              {handRaised ? "Mão levantada" : "Levantar a mão"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            aria-label={chatOpen ? "Fechar chat" : "Abrir chat"}
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-full transition",
              chatOpen ? "bg-amber-400 text-black" : "bg-white/10 text-white hover:bg-white/20",
            )}
          >
            <MessagesSquare className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              roomRef.current?.disconnect().catch(() => {});
              markLeft();
              onLeave();
            }}
            aria-label="Sair da sala"
            className="grid h-11 w-11 place-items-center rounded-full bg-red-500 text-white hover:bg-red-400"
          >
            <PhoneOff className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function GuestTile({
  participant,
  isLocal,
  preferScreen = false,
  cameraOnly = false,
  className,
}: {
  participant: Participant;
  isLocal: boolean;
  preferScreen?: boolean;
  cameraOnly?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const screenPub = participant.getTrackPublication(Track.Source.ScreenShare);
  const cameraPub = participant.getTrackPublication(Track.Source.Camera);
  const videoPub = cameraOnly ? cameraPub : preferScreen ? screenPub : cameraPub ?? screenPub;
  const isScreen = videoPub?.source === Track.Source.ScreenShare;
  const audioPub = participant.getTrackPublication(Track.Source.Microphone);

  const speaking = participant.isSpeaking;

  useEffect(() => {
    const el = videoRef.current;
    const track = videoPub?.track;
    if (!el || !track) return;
    track.attach(el);
    el.muted = true;
    el.play().catch(() => {});
    return () => {
      track.detach(el);
    };
  }, [videoPub?.trackSid, videoPub?.track]);

  useEffect(() => {
    const el = audioRef.current;
    const track = audioPub?.track;
    if (!el || !track || isLocal) return;
    track.attach(el);
    el.play().catch(() => {});
    return () => {
      track.detach(el);
    };
  }, [audioPub?.trackSid, audioPub?.track, isLocal]);

  const hasVideo = Boolean(videoPub?.track && !(videoPub as RemoteTrackPublication).isMuted);

  const restoreScreenFit = () => {
    const el = videoRef.current;
    if (!el || !isScreen) return;
    el.style.objectFit = "contain";
    el.style.objectPosition = "center";
    el.style.transform = "none";
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-neutral-950 ring-1",
        speaking ? "ring-2 ring-emerald-400/70" : "ring-white/10",
        className,
      )}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={restoreScreenFit}
          onResize={restoreScreenFit}
          style={isScreen ? { objectFit: "contain", objectPosition: "center", transform: "none" } : undefined}
          className={cn(
            "block h-full max-h-full w-full max-w-full",
            isScreen ? "bg-black" : "object-cover",
            isLocal && !isScreen && "scale-x-[-1]",
          )}

        />
      ) : (
        <div className="grid h-full w-full place-items-center text-sm text-white/50">
          {participant.name || "Convidado"}
        </div>
      )}
      {!isLocal && <audio ref={audioRef} autoPlay playsInline />}
      <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white/85">
        {participant.name || "Convidado"} {isLocal && "(tu)"}
      </div>
    </div>
  );
}
