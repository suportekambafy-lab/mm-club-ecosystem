/**
 * MediaTile — pure UI. Attaches a MediaTrack to a <video>/<audio> element
 * via the adapter. Never touches LiveKit types directly.
 */
import { memo, useEffect, useRef } from "react";
import type { MediaTrack, RoomActions, RoomParticipant } from "@/lib/room-state";
import { Mic, MicOff, Wifi, WifiOff } from "lucide-react";
import { MemberAvatar } from "@/components/mm/member-avatar";
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
    // Reset srcObject so a previously attached (stopped) MediaStream
    // doesn't leave the element in a "needs user gesture" state that
    // browsers surface as a native play overlay.
    try { (el as HTMLVideoElement).srcObject = null; } catch { /* noop */ }
    el.muted = true;
    el.autoplay = true;
    el.playsInline = true;
    actions.attachTrack(videoTrack.id, el);
    // Force playback after attach — LiveKit sets srcObject synchronously,
    // but some browsers require an explicit .play() after re-attach.
    const p = el.play();
    if (p && typeof p.catch === "function") p.catch(() => { /* autoplay suppressed */ });
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

  const isScreen = videoTrack?.source === "screen";
  const hasVideo = Boolean(videoTrack) && !videoTrack?.muted && (isScreen || participant.camOn !== false);

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
          muted
          disablePictureInPicture
          controls={false}
          className={cn(
            "h-full w-full",
            // Screen shares must never be cropped/zoomed — fit the whole frame.
            isScreen ? "bg-black object-contain" : "object-cover",
            participant.isLocal && videoTrack?.source === "camera" && "scale-x-[-1]",
          )}
        />
      ) : (

        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-950">
          <MemberAvatar
            name={participant.displayName}
            avatarUrl={participant.avatarUrl}
            verified={participant.role === "host"}
            size={128}
            className="shadow-2xl"
          />
        </div>
      )}

      {audioTrack && <audio ref={audioRef} autoPlay playsInline />}

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
