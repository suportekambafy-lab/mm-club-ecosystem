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
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2, Hand } from "lucide-react";
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
  const [room, setRoom] = useState<Room | null>(null);
  const [activeToken, setActiveToken] = useState(token);
  const [onStage, setOnStage] = useState(initialOnStage);
  const [handRaised, setHandRaised] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(prefs.micEnabled && initialOnStage);
  const [camOn, setCamOn] = useState(prefs.camEnabled && initialOnStage);
  const [, forceTick] = useState(0);

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
    const r = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = r;

    const rerender = () => forceTick((n) => n + 1);
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
      .on(RoomEvent.Disconnected, () => {
        if (!cancelled) onLeave();
      });

    (async () => {
      try {
        setConnecting(true);
        await r.connect(url, activeToken);
        if (cancelled) return;
        if (onStageRef.current) {
          if (prefs.micEnabled)
            await r.localParticipant.setMicrophoneEnabled(true, prefs.micId ? { deviceId: prefs.micId } : undefined);
          if (prefs.camEnabled)
            await r.localParticipant.setCameraEnabled(true, prefs.cameraId ? { deviceId: prefs.cameraId } : undefined);
          setMicOn(prefs.micEnabled);
          setCamOn(prefs.camEnabled);
        } else {
          setMicOn(false);
          setCamOn(false);
        }
        if (!cancelled) {
          setRoom(r);
          setConnecting(false);
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
  }, [activeToken, url]);


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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, forceTick]);

  const toggleMic = async () => {
    const r = roomRef.current;
    if (!r) return;
    const next = !micOn;
    await r.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  };
  const toggleCam = async () => {
    const r = roomRef.current;
    if (!r) return;
    const next = !camOn;
    await r.localParticipant.setCameraEnabled(next);
    setCamOn(next);
  };

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

  const cols = participants.length <= 1 ? 1 : participants.length <= 4 ? 2 : 3;

  return (
    <div className="relative flex h-full w-full flex-col bg-black">
      <div
        className="grid flex-1 gap-2 overflow-hidden p-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {participants.map((p) => (
          <GuestTile key={p.identity} participant={p} isLocal={p.identity === room?.localParticipant.identity} />
        ))}
      </div>

      {!onStage && (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
          <div className="rounded-full bg-black/70 px-3 py-1.5 text-[11px] text-white/70 ring-1 ring-white/10 backdrop-blur-md">
            Estás a assistir como convidado. Levanta a mão para pedires para falar.
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 ring-1 ring-white/10 backdrop-blur-md">
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

function GuestTile({ participant, isLocal }: { participant: Participant; isLocal: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const videoPub =
    participant.getTrackPublication(Track.Source.ScreenShare) ??
    participant.getTrackPublication(Track.Source.Camera);
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

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-neutral-950 ring-1",
        speaking ? "ring-2 ring-emerald-400/70" : "ring-white/10",
      )}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn("h-full w-full object-cover", isLocal && "scale-x-[-1]")}
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-sm text-white/50">
          {participant.name || "Convidado"}
        </div>
      )}
      {!isLocal && <audio ref={audioRef} autoPlay />}
      <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white/85">
        {participant.name || "Convidado"} {isLocal && "(tu)"}
      </div>
    </div>
  );
}
