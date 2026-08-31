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
  EncodingOptions,
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

/**
 * Build the full ingest URL for a Cloudflare Stream live input.
 *
 * HISTORY: an earlier attempt downgraded RTMPS/443 to plain RTMP/1935. That is
 * what silently killed the 31 Aug recording — every push died with
 * "connection closed remotely" / "stream wedged", and Cloudflare never saw the
 * input connect. RTMPS is the endpoint that actually works (it recorded the
 * 7 and 10 Aug lives), so RTMPS is the default again and plain RTMP is only a
 * secondary attempt if RTMPS refuses to start.
 */
export function buildRtmpTarget(
  rtmpsUrl: string,
  streamKey: string,
  variant: "rtmps" | "rtmp" = "rtmps",
): string {
  let base = rtmpsUrl.replace(/\/+$/, "");
  if (variant === "rtmps") {
    if (/^rtmp:\/\//i.test(base)) {
      base = base.replace(/^rtmp:\/\//i, "rtmps://").replace(/:1935(\/|$)/, ":443$1");
    }
  } else if (/^rtmps:\/\//i.test(base)) {
    base = base.replace(/^rtmps:\/\//i, "rtmp://").replace(/:443(\/|$)/, ":1935$1");
    if (!/:\d+/.test(base)) base = base.replace(/^rtmp:\/\/([^/]+)/i, "rtmp://$1:1935");
  }
  return `${base}/${streamKey}`;
}

/**
 * Room composite options — uses the MM Club branded egress template so the
 * recording looks like the live room (golden frame, name plates, stage layout)
 * instead of LiveKit's default plain grid.
 */
function compositeOptions() {
  const origin = (process.env.EGRESS_TEMPLATE_ORIGIN || "https://mmclub.pt").replace(/\/+$/, "");
  return {
    layout: "mmclub",
    customBaseUrl: `${origin}/egress/composite`,
    audioOnly: false,
    videoOnly: false,
    encodingOptions: new EncodingOptions({
      width: 1920,
      height: 1080,
      framerate: 30,
      videoBitrate: 6000,
      keyFrameInterval: 2,
      audioBitrate: 192,
      audioFrequency: 48000,
    }),
  } as const;
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
        compositeOptions(),
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
        compositeOptions(),
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

/**
 * Stop an egress and VERIFY it actually stopped.
 *
 * This used to be fire-and-forget with a swallowed error, which is how a live
 * ended up with an 11-hour "recording": the stop call failed, the RTMP push
 * kept feeding Cloudflare all night and the recorded file was unusable.
 */
export async function stopLiveRecording(egressId: string): Promise<boolean> {
  const { egress } = client();
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await egress.stopEgress(egressId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Already finished → nothing to stop.
      if (/not found|already|complete|ended/i.test(message)) return true;
      console.warn(`[live-egress] stop attempt ${attempt + 1} failed`, message);
    }
    try {
      const list = await egress.listEgress({ egressId });
      const still = list.some(
        (e) => e.status === EgressStatus.EGRESS_ACTIVE || e.status === EgressStatus.EGRESS_STARTING,
      );
      if (!still) return true;
    } catch {
      /* verification failed — retry the stop */
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  console.error("[live-egress] egress still active after retries", egressId);
  return false;
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
 * session that crashed). Stops anything still active and verifies it.
 */
export async function stopAllRoomEgress(roomName: string): Promise<boolean> {
  try {
    const { egress } = client();
    for (let attempt = 0; attempt < 4; attempt++) {
      const list = await egress.listEgress({ roomName, active: true });
      if (list.length === 0) return true;
      for (const e of list) {
        if (!e.egressId) continue;
        try {
          await egress.stopEgress(e.egressId);
        } catch (err) {
          console.warn("[live-egress] stopAllRoomEgress stop failed", e.egressId, err);
        }
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    const left = await egress.listEgress({ roomName, active: true });
    if (left.length) console.error("[live-egress] room still has active egress", roomName);
    return left.length === 0;
  } catch (err) {
    console.warn("[live-egress] stopAllRoomEgress failed", err);
    return false;
  }
}

/** All egresses currently active/starting across the LiveKit project. */
export async function listActiveEgress() {
  const { egress } = client();
  const list = await egress.listEgress({ active: true });
  return list.map((e) => ({
    egressId: e.egressId ?? null,
    roomName: e.roomName ?? null,
    status: EgressStatus[e.status] ?? String(e.status),
    startedAtMs: e.startedAt ? Math.round(Number(e.startedAt) / 1e6) : null,
  }));
}

/** `mmclub_main_<uuid>` → { target, liveId } */
export function parseRoomName(roomName: string): { target: string; liveId: string } | null {
  const m = /^mmclub_(main|backstage)_(.+)$/.exec(roomName);
  return m ? { target: m[1]!, liveId: m[2]! } : null;
}

