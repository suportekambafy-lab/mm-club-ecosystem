/**
 * LiveKit server SDK — token minting + room admin.
 * Server-only (imported by *.functions.ts handlers via dynamic import).
 */
import { AccessToken, RoomServiceClient, type VideoGrant } from "livekit-server-sdk";

export type LiveRoomTarget = "backstage" | "main";
export type LiveRole = "host" | "cohost" | "speaker" | "participant" | "viewer";

function readEnv() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) {
    throw new Error("LiveKit não configurado: LIVEKIT_URL/API_KEY/API_SECRET em falta.");
  }
  // LiveKit RoomServiceClient wants the https base, not the wss.
  const httpUrl = url.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:");
  return { url, httpUrl, apiKey, apiSecret };
}

export function livekitRoomName(liveId: string, target: LiveRoomTarget) {
  return `mmclub_${target}_${liveId}`;
}

interface MintTokenArgs {
  liveId: string;
  target: LiveRoomTarget;
  userId: string;
  displayName: string;
  role: LiveRole;
  // For participants that were promoted; overrides role-derived defaults.
  publishOverride?: { mic?: boolean; cam?: boolean; screen?: boolean };
  ttlSeconds?: number;
}

/**
 * Publisher = can send tracks (mic/cam/screen). Subscribe is always on.
 * Only host/cohost/speaker are publishers by default. Participants are
 * upgraded on the fly (new token) when promoted to stage.
 */
function grantFor(role: LiveRole, publishOverride?: MintTokenArgs["publishOverride"]): VideoGrant {
  const isPublisherByDefault = role === "host" || role === "cohost" || role === "speaker";
  const canPublish = publishOverride
    ? Boolean(publishOverride.mic || publishOverride.cam || publishOverride.screen)
    : isPublisherByDefault;

  return {
    roomJoin: true,
    canSubscribe: true,
    canPublish,
    canPublishData: true,
    // Restrict source types to what the participant is allowed to send.
    canPublishSources: publishOverride
      ? [
          ...(publishOverride.mic ? (["microphone"] as const) : []),
          ...(publishOverride.cam ? (["camera"] as const) : []),
          ...(publishOverride.screen ? (["screen_share", "screen_share_audio"] as const) : []),
        ]
      : isPublisherByDefault
      ? ["microphone", "camera", "screen_share", "screen_share_audio"]
      : [],
    // Only host/cohost can update room metadata (spotlight, layout).
    roomAdmin: role === "host" || role === "cohost",
    // Only host/cohost can act on other participants (mute, kick).
    // (LiveKit "roomAdmin" already covers this — kept explicit for clarity.)
  };
}

export async function mintLiveKitToken({
  liveId,
  target,
  userId,
  displayName,
  role,
  publishOverride,
  ttlSeconds = 60 * 60 * 6, // 6h
}: MintTokenArgs): Promise<{ token: string; url: string; room: string }> {
  const { url, apiKey, apiSecret } = readEnv();
  const room = livekitRoomName(liveId, target);
  const at = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    name: displayName,
    ttl: ttlSeconds,
    metadata: JSON.stringify({ role, target }),
  });
  at.addGrant({ ...grantFor(role, publishOverride), room });
  const token = await at.toJwt();
  return { token, url, room };
}

/**
 * Room admin client — mute/kick/update metadata on active rooms.
 * Load lazily inside handlers to avoid client-bundle leakage.
 */
export function roomServiceClient() {
  const { httpUrl, apiKey, apiSecret } = readEnv();
  return new RoomServiceClient(httpUrl, apiKey, apiSecret);
}

export interface LiveRoomMetadata {
  spotlightUserId: string | null;
  stageLayout: "solo" | "host_guest" | "spotlight" | "grid";
  enabledModules: string[];
}

export async function updateMainRoomMetadata(liveId: string, patch: Partial<LiveRoomMetadata>) {
  const svc = roomServiceClient();
  const room = livekitRoomName(liveId, "main");
  // Fetch current, merge, and write back.
  const rooms = await svc.listRooms([room]);
  const current = rooms[0];
  let merged: LiveRoomMetadata = {
    spotlightUserId: null,
    stageLayout: "grid",
    enabledModules: ["chat"],
  };
  if (current?.metadata) {
    try {
      merged = { ...merged, ...(JSON.parse(current.metadata) as LiveRoomMetadata) };
    } catch {
      /* ignore malformed */
    }
  }
  merged = { ...merged, ...patch };
  await svc.updateRoomMetadata(room, JSON.stringify(merged));
  return merged;
}

export async function forceRemoveParticipant(liveId: string, target: LiveRoomTarget, userId: string) {
  const svc = roomServiceClient();
  const room = livekitRoomName(liveId, target);
  try {
    await svc.removeParticipant(room, userId);
  } catch {
    /* participant may already be gone */
  }
}

export async function mutePublisher(
  liveId: string,
  target: LiveRoomTarget,
  userId: string,
  trackSid: string,
  muted: boolean,
) {
  const svc = roomServiceClient();
  const room = livekitRoomName(liveId, target);
  await svc.mutePublishedTrack(room, userId, trackSid, muted);
}
