/**
 * Server-side LiveKit Egress control — Principle #5: recording is 100%
 * server-side and completely independent of the host's browser.
 *
 * We use RoomCompositeEgress: LiveKit renders the room (via its cloud
 * template) and pushes the resulting mixed MP4 to storage. If the host
 * closes their laptop, refreshes, or loses connectivity, the egress keeps
 * running until endLive stops it (or the room empties for the configured
 * grace period).
 *
 * Storage: reuse Cloudflare R2 credentials already configured for
 * broadcasts (LIVEKIT_EGRESS_S3_* env vars). If not configured, egress
 * falls back to LiveKit Cloud's default recorded segment output which we
 * can pull later.
 */
import { EgressClient, EncodedFileType, type EncodedFileOutput } from "livekit-server-sdk";

interface EgressEnv {
  url: string;
  apiKey: string;
  apiSecret: string;
  s3?: {
    accessKey: string;
    secret: string;
    region: string;
    bucket: string;
    endpoint?: string;
  };
}

function readEnv(): EgressEnv {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) throw new Error("LiveKit não configurado.");
  const httpUrl = url.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:");

  const s3Access = process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY;
  const s3Secret = process.env.LIVEKIT_EGRESS_S3_SECRET;
  const s3Bucket = process.env.LIVEKIT_EGRESS_S3_BUCKET;
  const s3Region = process.env.LIVEKIT_EGRESS_S3_REGION ?? "auto";
  const s3Endpoint = process.env.LIVEKIT_EGRESS_S3_ENDPOINT;

  return {
    url: httpUrl,
    apiKey,
    apiSecret,
    s3:
      s3Access && s3Secret && s3Bucket
        ? { accessKey: s3Access, secret: s3Secret, region: s3Region, bucket: s3Bucket, endpoint: s3Endpoint }
        : undefined,
  };
}

function client() {
  const env = readEnv();
  return { egress: new EgressClient(env.url, env.apiKey, env.apiSecret), env };
}

/**
 * Start a room-composite recording of the main room for a live session.
 * Returns the egress id (persist it on the live row so we can stop it).
 */
export async function startLiveRecording(args: { liveId: string; roomName: string }): Promise<string | null> {
  try {
    const { egress, env } = client();
    const filepath = `mmclub/lives/${args.liveId}/${Date.now()}.mp4`;
    const output: EncodedFileOutput = {
      fileType: EncodedFileType.MP4,
      filepath,
      // Cloudflare R2 exposes an S3-compatible endpoint; LiveKit Egress supports it via s3 config.
      ...(env.s3
        ? {
            s3: {
              accessKey: env.s3.accessKey,
              secret: env.s3.secret,
              region: env.s3.region,
              bucket: env.s3.bucket,
              endpoint: env.s3.endpoint,
              forcePathStyle: true,
            },
          }
        : {}),
    } as EncodedFileOutput;

    const info = await egress.startRoomCompositeEgress(args.roomName, { file: output }, {
      layout: "grid",
      audioOnly: false,
      videoOnly: false,
    });
    return info.egressId ?? null;
  } catch (err) {
    console.warn("[live-egress] start failed", err);
    return null;
  }
}

export async function stopLiveRecording(egressId: string): Promise<void> {
  try {
    const { egress } = client();
    await egress.stopEgress(egressId);
  } catch (err) {
    console.warn("[live-egress] stop failed", err);
  }
}
