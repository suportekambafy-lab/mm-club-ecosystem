/**
 * <GuestRoom> — minimal LiveKit room for external guests (no MM Club account).
 *
 * Self-contained on purpose: guests have no Supabase session, so this view
 * reads everything from the LiveKit room itself (participants, tracks) rather
 * than from Postgres like the member experience does.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteTrackPublication,
} from "livekit-client";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaPrefs } from "@/lib/media-prefs";

interface Props {
  token: string;
  url: string;
  prefs: MediaPrefs;
  onLeave: () => void;
}

export function GuestRoom({ token, url, prefs, onLeave }: Props) {
  const roomRef = useRef<Room | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(prefs.micEnabled);
  const [camOn, setCamOn] = useState(prefs.camEnabled);
  const [, forceTick] = useState(0);

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
        await r.connect(url, token);
        if (cancelled) return;
        if (prefs.micEnabled) await r.localParticipant.setMicrophoneEnabled(true, prefs.micId ? { deviceId: prefs.micId } : undefined);
        if (prefs.camEnabled) await r.localParticipant.setCameraEnabled(true, prefs.cameraId ? { deviceId: prefs.cameraId } : undefined);
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
  }, [token, url]);

  const participants: Participant[] = useMemo(() => {
    if (!room) return [];
    return [room.localParticipant as Participant, ...Array.from(room.remoteParticipants.values())];
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

      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 ring-1 ring-white/10 backdrop-blur-md">
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
            onClick={() => {
              roomRef.current?.disconnect().catch(() => {});
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
