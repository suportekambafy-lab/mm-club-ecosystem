/**
 * MediaTile — pure UI. Attaches a MediaTrack to a <video>/<audio> element
 * via the adapter. Never touches LiveKit types directly.
 */
import { memo, useEffect, useRef, useState } from "react";
import type { MediaTrack, RoomActions, RoomParticipant } from "@/lib/room-state";
import { Mic, MicOff, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  participant: RoomParticipant;
  actions: RoomActions;
  className?: string;
  /** When true, treat screen share as primary. */
  preferScreen?: boolean;
  showName?: boolean;
  /** Skip binding the audio track (useful for a PiP overlay where the primary
   *  tile already plays the participant's audio). */
  suppressAudio?: boolean;
}

function MediaTileBase({ participant, actions, className, preferScreen, showName = true, suppressAudio }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [avatarBroken, setAvatarBroken] = useState(false);

  const videoTrack: MediaTrack | undefined =
    (preferScreen && participant.tracks.find((t) => t.kind === "video" && t.source === "screen")) ||
    participant.tracks.find((t) => t.kind === "video" && t.source === "camera") ||
    participant.tracks.find((t) => t.kind === "video");
  const audioTrack: MediaTrack | undefined = suppressAudio
    ? undefined
    : participant.tracks.find((t) => t.kind === "audio" && !participant.isLocal);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoTrack) return;
    actions.attachTrack(videoTrack.id, el);
    return () => {
      actions.detachTrack(videoTrack.id, el);
    };
  }, [videoTrack?.id, actions]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioTrack) return;
    actions.attachTrack(audioTrack.id, el);
    return () => {
      actions.detachTrack(audioTrack.id, el);
    };
  }, [audioTrack?.id, actions]);

  // Consider camera on when we have a video track that isn't muted AND the
  // participant hasn't explicitly disabled the camera.
  const hasVideo = Boolean(videoTrack) && !videoTrack?.muted && participant.camOn !== false;

  const initials = (participant.displayName || "?").trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase() || "?";
  const showAvatarImage = Boolean(participant.avatarUrl) && !avatarBroken;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-neutral-950 ring-1 ring-white/5 transition-all",
        participant.isSpeaking && "ring-2 ring-[hsl(45_86%_60%)]",
        className,
      )}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          // Always mute the <video>: remote audio is bound to a separate
          // <audio> element (see below). Muting eliminates the browser's
          // autoplay-blocked "play" overlay on toggling the camera back on
          // and mirrors what Meet/Zoom do.
          muted
          disablePictureInPicture
          controls={false}
          className={cn(
            "h-full w-full object-cover",
            // Mirror the local camera so users see themselves like a mirror —
            // Meet/Zoom convention. Never mirror screen shares.
            participant.isLocal && videoTrack?.source === "camera" && "scale-x-[-1]",
          )}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-950">
          {showAvatarImage ? (
            <img
              src={participant.avatarUrl ?? ""}
              alt=""
              onError={() => setAvatarBroken(true)}
              className="h-24 w-24 rounded-full object-cover ring-2 ring-white/10 shadow-2xl sm:h-32 sm:w-32"
            />
          ) : (
            <div className="grid h-24 w-24 place-items-center rounded-full bg-white/[0.06] text-2xl font-semibold text-white/85 ring-2 ring-white/10 shadow-2xl sm:h-32 sm:w-32 sm:text-3xl">
              {initials}
            </div>
          )}
        </div>
      )}

      {audioTrack && <audio ref={audioRef} autoPlay />}

      {showName && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2.5">
          <div className="flex min-w-0 items-center gap-1.5 rounded-md bg-black/40 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
            <span className="truncate">{participant.displayName}</span>
            {participant.role === "host" && <span className="text-[10px] text-[hsl(45_86%_60%)]">HOST</span>}
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-black/40 px-1.5 py-1 backdrop-blur-sm">
            {participant.micOn === false || (participant.tracks.find((t) => t.source === "microphone")?.muted ?? true) ? (
              <MicOff className="h-3.5 w-3.5 text-red-400" />
            ) : (
              <Mic className="h-3.5 w-3.5 text-emerald-400" />
            )}
            {participant.connectionQuality === "poor" || participant.connectionQuality === "lost" ? (
              <WifiOff className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <Wifi className="h-3.5 w-3.5 text-white/60" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Memo comparator: re-render the tile only when *this* participant's
 * media-relevant fields change. Chat/reactions/other participants must
 * NOT cause tile churn.
 */
export const MediaTile = memo(MediaTileBase, (a, b) => {
  const pa = a.participant;
  const pb = b.participant;
  if (pa.userId !== pb.userId) return false;
  if (pa.tracks.length !== pb.tracks.length) return false;
  for (let i = 0; i < pa.tracks.length; i++) {
    if (pa.tracks[i].id !== pb.tracks[i].id || pa.tracks[i].muted !== pb.tracks[i].muted) return false;
  }
  return (
    pa.displayName === pb.displayName &&
    pa.avatarUrl === pb.avatarUrl &&
    pa.role === pb.role &&
    pa.micOn === pb.micOn &&
    pa.camOn === pb.camOn &&
    pa.isSpeaking === pb.isSpeaking &&
    pa.connectionQuality === pb.connectionQuality &&
    a.preferScreen === b.preferScreen &&
    a.showName === b.showName &&
    a.suppressAudio === b.suppressAudio &&
    a.className === b.className
  );
});
