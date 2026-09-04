/**
 * Resumable HLS transcription.
 *
 * Long lessons (2-3h) never finished in a single worker invocation: the run
 * was killed by the runtime timeout, the row stayed locked as "transcribing"
 * and the next tick restarted from zero — forever.
 *
 * This module splits the media into deterministic byte-bounded parts and
 * transcribes only a few parts per tick, persisting each part in
 * `lesson_transcript_parts`. The next tick resumes exactly where it stopped.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const TRANSCRIBE_MODEL = "openai/gpt-4o-mini-transcribe";

const MAX_PART_BYTES = 18 * 1024 * 1024;
/** Parts processed per tick (each ~18MB of audio+video segments). */
export const MAX_PARTS_PER_TICK = 6;
const PART_CONCURRENCY = 2;
const SEGMENT_CONCURRENCY = 8;
/** Stop starting new parts after this, so the tick always returns saved progress. */
const TICK_BUDGET_MS = 70_000;

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((a, b) => a + b.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const part of parts) {
    out.set(part, off);
    off += part.byteLength;
  }
  return out;
}

function parseHlsAttributes(input: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input))) {
    attrs[match[1].toUpperCase()] = match[2].replace(/^"|"$/g, "");
  }
  return attrs;
}

async function transmuxTsToAudioMp4(bytes: Uint8Array): Promise<Uint8Array> {
  const muxjs = ((await import("mux.js")) as any).default;
  const Transmuxer = muxjs?.mp4?.Transmuxer;
  if (!Transmuxer) throw new Error("Conversor HLS indisponível");

  const outputs: Uint8Array[] = [];
  const transmuxer = new Transmuxer({ remux: false, keepOriginalTimestamps: false });
  transmuxer.on("data", (data: any) => {
    if (data?.type !== "audio") return;
    const parts: Uint8Array[] = [];
    if (data.initSegment?.byteLength) parts.push(data.initSegment);
    if (data.data?.byteLength) parts.push(data.data);
    if (parts.length) outputs.push(concatBytes(parts));
  });
  transmuxer.push(bytes);
  transmuxer.flush();

  const audio = concatBytes(outputs);
  if (audio.byteLength < 2048) {
    throw new Error("Esta variante HLS não contém áudio transcrevível.");
  }
  return audio;
}

async function transcribeBytes(
  bytes: Uint8Array,
  filename: string,
  mime: string,
  apiKey: string,
): Promise<string> {
  const form = new FormData();
  form.append("model", TRANSCRIBE_MODEL);
  form.append("file", new Blob([bytes as BlobPart], { type: mime }), filename);
  const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { "Lovable-API-Key": apiKey },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Transcrição ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { text?: string };
  return json.text ?? "";
}

export type HlsPlan = {
  segments: string[];
  initUri: string | null;
  isFmp4: boolean;
  /** Deterministic grouping of segment indexes into byte-bounded parts. */
  parts: Array<{ start: number; end: number }>;
};

async function fetchText(u: string) {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`HLS ${r.status} em ${u}`);
  return r.text();
}

/** Resolve a master playlist to an audio-friendly media playlist and list its segments. */
export async function buildHlsPlan(playlistUrl: string): Promise<HlsPlan> {
  let mediaUrl = playlistUrl;
  let text = await fetchText(mediaUrl);

  if (text.includes("#EXT-X-STREAM-INF")) {
    const lines = text.split(/\r?\n/);
    const audioRenditions = new Map<string, string>();
    for (const line of lines) {
      if (!line.startsWith("#EXT-X-MEDIA") || !/TYPE=AUDIO/i.test(line)) continue;
      const attrs = parseHlsAttributes(line);
      if (attrs.URI && attrs["GROUP-ID"]) {
        audioRenditions.set(attrs["GROUP-ID"], new URL(attrs.URI, mediaUrl).toString());
      }
    }
    let bestUri: string | null = null;
    let bestBw = Infinity;
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith("#EXT-X-STREAM-INF")) continue;
      const attrs = parseHlsAttributes(lines[i]);
      const audioPlaylist = attrs.AUDIO ? audioRenditions.get(attrs.AUDIO) : null;
      if (audioPlaylist) {
        bestUri = audioPlaylist;
        break;
      }
      const hasAudioCodec = /mp4a|aac|opus|audio/i.test(attrs.CODECS ?? "");
      const bw = Number(attrs.BANDWIDTH ?? Infinity);
      const uri = lines[i + 1]?.trim();
      if (uri && !uri.startsWith("#") && hasAudioCodec && bw < bestBw) {
        bestBw = bw;
        bestUri = uri;
      }
    }
    if (!bestUri) {
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith("#EXT-X-STREAM-INF")) continue;
        const attrs = parseHlsAttributes(lines[i]);
        const bw = Number(attrs.BANDWIDTH ?? Infinity);
        const uri = lines[i + 1]?.trim();
        if (uri && !uri.startsWith("#") && bw < bestBw) {
          bestBw = bw;
          bestUri = uri;
        }
      }
    }
    if (!bestUri) throw new Error("Master HLS sem variantes utilizáveis");
    mediaUrl = new URL(bestUri, mediaUrl).toString();
    text = await fetchText(mediaUrl);
  }

  if (/^#EXT-X-KEY:.*METHOD=(?!NONE)/im.test(text)) {
    throw new Error("Este HLS está encriptado/protegido e não pode ser transcrito diretamente.");
  }

  const lines = text.split(/\r?\n/);
  let initUri: string | null = null;
  const initTag = lines.find((l) => l.startsWith("#EXT-X-MAP"));
  if (initTag) {
    const u = initTag.match(/URI="([^"]+)"/)?.[1];
    if (u) initUri = new URL(u, mediaUrl).toString();
  }

  const segments = lines
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => new URL(l, mediaUrl).toString());
  if (!segments.length) throw new Error("HLS sem segmentos");

  // Deterministic grouping: use the declared segment durations so the split is
  // stable across ticks (byte sizes are unknown until download).
  const durations: number[] = [];
  for (const line of lines) {
    const m = line.match(/^#EXTINF:([0-9.]+)/);
    if (m) durations.push(Number(m[1]));
  }
  const avgDur = durations.length
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 6;
  // ~5 min of media per part: smaller uploads transcribe far faster and each
  // finished part is saved, so progress never restarts from zero.
  const segmentsPerPart = Math.max(1, Math.min(200, Math.round(300 / Math.max(1, avgDur))));

  const parts: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < segments.length; i += segmentsPerPart) {
    parts.push({ start: i, end: Math.min(segments.length, i + segmentsPerPart) });
  }

  return { segments, initUri, isFmp4: !!initUri, parts };
}

/** Download + transcribe a single part (range of segments). */
async function transcribePart(
  plan: HlsPlan,
  part: { start: number; end: number },
  initBytes: Uint8Array | null,
  apiKey: string,
): Promise<string> {
  const urls = plan.segments.slice(part.start, part.end);
  const chunks: Uint8Array[] = initBytes ? [initBytes] : [];
  let size = initBytes?.byteLength ?? 0;

  for (let i = 0; i < urls.length; i += SEGMENT_CONCURRENCY) {
    const slice = urls.slice(i, i + SEGMENT_CONCURRENCY);
    const fetched = await Promise.all(
      slice.map(async (segUrl) => {
        const r = await fetch(segUrl);
        if (!r.ok) throw new Error(`Segmento HLS ${r.status}`);
        return new Uint8Array(await r.arrayBuffer());
      }),
    );
    for (const b of fetched) {
      if (size + b.byteLength > MAX_PART_BYTES) break;
      chunks.push(b);
      size += b.byteLength;
    }
  }

  const raw = concatBytes(chunks);
  const payload = plan.isFmp4 ? raw : await transmuxTsToAudioMp4(raw);
  const text = await transcribeBytes(
    payload,
    plan.isFmp4 ? "part.mp4" : "part.m4a",
    plan.isFmp4 ? "video/mp4" : "audio/mp4",
    apiKey,
  );
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Parte devolveu transcrição vazia — retry no próximo ciclo.");
  return trimmed;
}

export type ResumableResult =
  | { done: true; transcript: string; totalParts: number }
  | { done: false; completedParts: number; totalParts: number };

/**
 * Transcribes up to `maxParts` outstanding parts of a lesson and stores them.
 * Returns `done: true` with the full transcript once every part exists.
 */
export async function transcribeLessonResumable(opts: {
  courseId: string;
  lessonId: string;
  playlistUrl: string;
  apiKey: string;
  maxParts?: number;
}): Promise<ResumableResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const plan = await buildHlsPlan(opts.playlistUrl);
  const total = plan.parts.length;

  const { data: existing } = await supabaseAdmin
    .from("lesson_transcript_parts")
    .select("part_index,text")
    .eq("course_id", opts.courseId)
    .eq("lesson_id", opts.lessonId);

  const doneMap = new Map<number, string>();
  for (const r of (existing ?? []) as Array<{ part_index: number; text: string }>) {
    doneMap.set(r.part_index, r.text);
  }

  const todo = plan.parts
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => !doneMap.has(i))
    .slice(0, opts.maxParts ?? MAX_PARTS_PER_TICK);

  if (todo.length) {
    const initBytes = plan.initUri
      ? new Uint8Array(await (await fetch(plan.initUri)).arrayBuffer())
      : null;

    const startedAt = Date.now();
    let lastError: string | null = null;

    /** Persist a finished part immediately — progress must survive a worker timeout. */
    const persist = async (index: number, text: string) => {
      const { error } = await supabaseAdmin.from("lesson_transcript_parts").upsert(
        {
          course_id: opts.courseId,
          lesson_id: opts.lessonId,
          part_index: index,
          text,
        },
        { onConflict: "course_id,lesson_id,part_index" },
      );
      if (error) throw new Error(error.message);
      doneMap.set(index, text);
    };

    for (let i = 0; i < todo.length; i += PART_CONCURRENCY) {
      if (Date.now() - startedAt > TICK_BUDGET_MS) break;
      const slice = todo.slice(i, i + PART_CONCURRENCY);
      const settled = await Promise.allSettled(
        slice.map(async ({ p, i: index }) => {
          const text = await transcribePart(plan, p, initBytes, opts.apiKey);
          await persist(index, text);
        }),
      );
      for (const r of settled) {
        if (r.status === "rejected") lastError = String((r.reason as Error)?.message ?? r.reason);
      }
    }

    // Nothing at all landed and something broke: surface the error so the queue
    // shows a real reason instead of looping silently.
    if (!doneMap.size && lastError) throw new Error(lastError);
  }

  if (doneMap.size < total) {
    return { done: false, completedParts: doneMap.size, totalParts: total };
  }

  const transcript = Array.from({ length: total }, (_, i) => doneMap.get(i) ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  await supabaseAdmin
    .from("lesson_transcript_parts")
    .delete()
    .eq("course_id", opts.courseId)
    .eq("lesson_id", opts.lessonId);

  return { done: true, transcript, totalParts: total };
}
