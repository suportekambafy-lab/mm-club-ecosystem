/**
 * Abstract room state — engine-agnostic types the UI consumes.
 *
 * The <Stage>, <Backstage>, <InteractiveRoom> and every UI module read
 * only these types. The concrete video engine (LiveKit today, potentially
 * Daily / Agora / Livepeer tomorrow) is confined to an adapter that
 * projects its native state into this shape.
 *
 * Never import from "livekit-client" in a UI component — go through
 * useRoomState() instead.
 */

export type RoomRole = "host" | "cohost" | "speaker" | "participant" | "viewer";
export type RoomTarget = "backstage" | "main";
export type StageLayout = "solo" | "host_guest" | "spotlight" | "grid" | "auto";
export type RoomStatus = "scheduled" | "backstage" | "live" | "ended";
export type ConnectionQuality = "excellent" | "good" | "poor" | "lost";

/** A published media track, abstracted from the engine. */
export interface MediaTrack {
  /** Stable id across the engine (e.g. LiveKit trackSid). */
  id: string;
  kind: "video" | "audio";
  source: "camera" | "microphone" | "screen" | "screen_audio" | "unknown";
  muted: boolean;
  /**
   * Opaque engine handle; the tile component receives it and asks the
   * adapter to attach/detach it to a <video>/<audio> element. UI never
   * inspects this directly.
   */
  engineRef: unknown;
}

/** A single participant as seen by the UI. */
export interface RoomParticipant {
  /** Auth user id (stable across reconnects). */
  userId: string;
  /** Optional engine identity (may differ if guest, etc.). */
  identity?: string;
  displayName: string;
  avatarUrl?: string | null;
  role: RoomRole;
  room: RoomTarget;

  // Stage / permissions
  onStage: boolean;
  micAllowed: boolean;
  camAllowed: boolean;
  screenAllowed: boolean;

  // Live media state (from engine adapter — may be undefined for viewers)
  micOn?: boolean;
  camOn?: boolean;
  isScreenSharing?: boolean;
  isSpeaking?: boolean;
  connectionQuality?: ConnectionQuality;

  tracks: MediaTrack[];

  // Interaction state (from postgres)
  handRaisedAt?: string | null;
  invitedToStageAt?: string | null;
  banned?: boolean;

  /** True if this participant row represents the local user. */
  isLocal: boolean;
}

/** Optional AI extension points — populated by future modules. */
export interface RoomAIState {
  captions?: Array<{ id: string; speakerId: string; text: string; ts: number }>;
  transcript?: Array<{ id: string; speakerId: string; text: string; from: number; to: number }>;
  activeAssistant?: { kind: "summary" | "qa" | "translate"; state: "idle" | "thinking" | "done" };
}

/** Snapshot the UI reads. Immutable per render. */
export interface RoomState {
  liveId: string;
  status: RoomStatus;
  mode: "broadcast" | "interactive";
  target: RoomTarget;

  // Layout is either explicit (host-forced) or computed automatically.
  layout: StageLayout;
  effectiveLayout: Exclude<StageLayout, "auto">;
  spotlightUserId: string | null;
  activeSpeakerId: string | null;

  // Timings
  startedAt: string | null;
  wentLiveAt: string | null;
  backstageStartedAt: string | null;

  // People
  localUserId: string;
  localRole: RoomRole;
  participants: RoomParticipant[];
  /** Participants currently visible on stage (onStage && room==="main"). */
  onStage: RoomParticipant[];
  /** Audience — viewers only, may be large. Virtualize the list. */
  audience: RoomParticipant[];
  /** Backstage occupants (rehearsal). */
  backstage: RoomParticipant[];

  // Connection
  connection: {
    state: "connecting" | "connected" | "reconnecting" | "disconnected";
    quality: ConnectionQuality;
  };

  /** Browser blocked remote audio autoplay — needs a user gesture. */
  audioBlocked: boolean;

  // Modules toggled on
  enabledModules: string[];

  // AI extension slot (populated later; never required)
  ai?: RoomAIState;
}


/** Actions the UI dispatches. Adapter implements them. */
export interface RoomActions {
  toggleMic(): Promise<void>;
  toggleCam(): Promise<void>;
  startScreenShare(): Promise<void>;
  stopScreenShare(): Promise<void>;
  leave(): Promise<void>;

  raiseHand(raised: boolean): Promise<void>;

  // Host / cohost only (adapter no-ops for others).
  inviteToStage(userId: string): Promise<void>;
  promoteToStage(userId: string, opts?: { role?: "speaker" | "cohost" }): Promise<void>;
  demoteFromStage(userId: string): Promise<void>;
  setSpotlight(userId: string | null): Promise<void>;
  setLayout(layout: StageLayout): Promise<void>;
  goLive(): Promise<void>;
  endLive(): Promise<void>;
  kick(userId: string): Promise<void>;
  ban(userId: string): Promise<void>;

  // Media element binding — adapter attaches the engine track to the DOM node.
  attachTrack(trackId: string, el: HTMLMediaElement): void;
  detachTrack(trackId: string, el: HTMLMediaElement): void;
}

/** Pure layout resolver — no engine dependency. */
export function resolveLayout(
  requested: StageLayout,
  onStageCount: number,
  spotlightUserId: string | null,
): Exclude<StageLayout, "auto"> {
  if (requested !== "auto") return requested;
  if (spotlightUserId) return "spotlight";
  if (onStageCount <= 1) return "solo";
  if (onStageCount === 2) return "host_guest";
  return "grid";
}
