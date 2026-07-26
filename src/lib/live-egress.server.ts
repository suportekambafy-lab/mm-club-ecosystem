/**
 * Server-side LiveKit Egress control — recording is 100% server-side and
 * completely independent of the host's browser.
 *
 * Primary path (interactive rooms): RoomCompositeEgress with an **RTMP stream
 * output** pointed at the live's Cloudflare Stream Live Input. Cloudflare
 * records automatically (`recording.mode = automatic`), so the recording lands
 * in the exact same place as broadcast lives and the existing pipeline
 * (`/api/public/cloudflare-stream/webhook` + the `lives-recording-check` cron)
 * fills `recording_video_uid` and flips the live to `published` only when the
 * file is actually ready to stream.
 *
 * Fallback path: if S3/R2 credentials are configured (LIVEKIT_EGRESS_S3_*)
 * and no Cloudflare input exists, we write an MP4 file to that bucket.
 */
import {
  EgressClient,
  EgressStatus,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
  StreamOutput,
  StreamProtocol,
} from "livekit-server-sdk";

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

/** Build the full RTMPS ingest URL for a Cloudflare Stream live input. */
export function buildRtmpTarget(rtmpsUrl: string, streamKey: string): string {
  const base = rtmpsUrl.replace(/\/+$/, "");
  return `${base}/${streamKey}`;
}

export type StartRecordingResult = {
  egressId: string | null;
  /** "cloudflare" = RTMP into CF Stream, "s3" = MP4 file output. */
  target: "cloudflare" | "s3" | null;
  filepath: string | null;
  error: string | null;
};

/**
 * Start a room-composite recording of the main room for a live session.
 * Returns the egress id (persist it on the live row so we can stop it).
 */
export async function startLiveRecording(args: {
  liveId: string;
  roomName: string;
  rtmpsUrl?: string | null;
  streamKey?: string | null;
}): Promise<StartRecordingResult> {
  try {
    const { egress, env } = client();

    // 1) Preferred: push the composed room into Cloudflare Stream over RTMPS.
    if (args.rtmpsUrl && args.streamKey) {
      const stream = new StreamOutput({
        protocol: StreamProtocol.RTMP,
        urls: [buildRtmpTarget(args.rtmpsUrl, args.streamKey)],
      });

      const info = await egress.startRoomCompositeEgress(
        args.roomName,
        { stream },
        { layout: "grid", audioOnly: false, videoOnly: false },
      );
      return {
        egressId: info.egressId ?? null,
        target: "cloudflare",
        filepath: null,
        error: null,
      };
    }

    // 2) Fallback: MP4 into the configured S3/R2 bucket.
    if (env.s3) {
      const filepath = `mmclub/lives/${args.liveId}/${Date.now()}.mp4`;
      const output = new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath,
        output: {
          case: "s3",
          value: new S3Upload({
            accessKey: env.s3.accessKey,
            secret: env.s3.secret,
            region: env.s3.region,
            bucket: env.s3.bucket,
            endpoint: env.s3.endpoint,
            forcePathStyle: true,
          }),
        },
      });

      const info = await egress.startRoomCompositeEgress(
        args.roomName,
        { file: output },
        { layout: "grid", audioOnly: false, videoOnly: false },
      );
      return { egressId: info.egressId ?? null, target: "s3", filepath, error: null };
    }

    return {
      egressId: null,
      target: null,
      filepath: null,
      error: "Sem destino de gravação: falta o live input do Cloudflare Stream e credenciais S3/R2.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[live-egress] start failed", message);
    return { egressId: null, target: null, filepath: null, error: message };
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

/** Diagnostics: current status of a given egress (or of the room's egresses). */
export async function getRecordingStatus(args: { egressId?: string; roomName?: string }) {
  const { egress } = client();
  const list = await egress.listEgress(
    args.egressId ? { egressId: args.egressId } : { roomName: args.roomName },
  );
  return list.map((e) => ({
    egressId: e.egressId,
    roomName: e.roomName,
    status: EgressStatus[e.status] ?? String(e.status),
    error: e.error || null,
    startedAt: e.startedAt ? Number(e.startedAt) : null,
    endedAt: e.endedAt ? Number(e.endedAt) : null,
  }));
}

/**
 * Ensure a stale/aborted egress isn't left running for a room (e.g. a previous
 * session that crashed). Stops anything still active.
 */
export async function stopAllRoomEgress(roomName: string): Promise<void> {
  try {
    const { egress } = client();
    const list = await egress.listEgress({ roomName, active: true });
    for (const e of list) {
      if (!e.egressId) continue;
      try {
        await egress.stopEgress(e.egressId);
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    console.warn("[live-egress] stopAllRoomEgress failed", err);
  }
}
