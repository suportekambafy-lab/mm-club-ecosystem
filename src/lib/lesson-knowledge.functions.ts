import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const TRANSCRIBE_MODEL = "openai/gpt-4o-mini-transcribe";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const CHUNK_TARGET_CHARS = 1400;

// -------- helpers (server-only) --------

function requireAiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY não configurada");
  return key;
}

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso apenas para administradores");
}

function chunkText(text: string, targetChars = CHUNK_TARGET_CHARS): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  // Split on sentence boundaries, then greedily group into ~targetChars chunks
  // with slight overlap to preserve context across boundaries.
  const sentences = clean.match(/[^.!?…]+[.!?…]+|\S+$/g) ?? [clean];
  const chunks: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + " " + s).trim().length > targetChars && buf) {
      chunks.push(buf.trim());
      // 120-char overlap for continuity
      buf = buf.slice(-120) + " " + s;
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

async function embedBatch(inputs: string[], apiKey: string): Promise<number[][]> {
  // OpenAI text-embedding-3-small: 8192 tokens per input, 300k tokens per request.
  // We chunk ~1400 chars → ~350 tokens, safe to send in batches of 64.
  const out: number[][] = [];
  const batchSize = 64;
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const res = await fetch(`${GATEWAY}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Embeddings ${res.status}: ${body.slice(0, 400)}`);
    }
    const json = (await res.json()) as { data: Array<{ embedding: number[]; index: number }> };
    // Preserve order
    const ordered = [...json.data].sort((a, b) => a.index - b.index);
    for (const d of ordered) out.push(d.embedding);
  }
  return out;
}

function resolveDirectMediaUrl(url: string): string {
  // Bunny Stream iframe embed → direct HLS playlist via pull zone env var.
  const m = url.match(/iframe\.mediadelivery\.net\/(?:embed|play)\/(\d+)\/([0-9a-f-]{36})/i);
  if (m) {
    const guid = m[2];
    const pullZone = process.env.VITE_BUNNY_PULL_ZONE || process.env.BUNNY_PULL_ZONE;
    if (pullZone) {
      return `https://${pullZone}.b-cdn.net/${guid}/playlist.m3u8`;
    }
  }
  return url;
}

async function transcribeChunk(
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
    throw new Error("Esta variante HLS não contém áudio transcrevível. Verifica se a aula tem faixa de áudio ativa.");
  }
  return audio;
}

async function transcribeFromHls(playlistUrl: string, apiKey: string): Promise<string> {
  // Fetch playlist; if it's a master, pick the lowest-bandwidth variant to
  // maximise minutes-per-MB (transcription doesn't need high resolution).
  const fetchText = async (u: string) => {
    const r = await fetch(u);
    if (!r.ok) throw new Error(`HLS ${r.status} em ${u}`);
    return r.text();
  };
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
      if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
        const attrs = parseHlsAttributes(lines[i]);
        const audioPlaylist = attrs.AUDIO ? audioRenditions.get(attrs.AUDIO) : null;
        if (audioPlaylist) {
          bestUri = audioPlaylist;
          break;
        }
        const codecs = attrs.CODECS ?? "";
        const hasAudioCodec = /mp4a|aac|opus|audio/i.test(codecs);
        const bw = Number(attrs.BANDWIDTH ?? Infinity);
        const uri = lines[i + 1]?.trim();
        if (uri && !uri.startsWith("#") && hasAudioCodec && bw < bestBw) {
          bestBw = bw;
          bestUri = uri;
        }
      }
    }
    if (!bestUri) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
          const attrs = parseHlsAttributes(lines[i]);
          const bw = Number(attrs.BANDWIDTH ?? Infinity);
          const uri = lines[i + 1]?.trim();
          if (uri && !uri.startsWith("#") && bw < bestBw) {
            bestBw = bw;
            bestUri = uri;
          }
        }
      }
    }
    if (!bestUri) throw new Error("Master HLS sem variantes utilizáveis");
    mediaUrl = new URL(bestUri, mediaUrl).toString();
    text = await fetchText(mediaUrl);
  }

  if (/^#EXT-X-KEY:.*METHOD=(?!NONE)/im.test(text)) {
    throw new Error("Este HLS está encriptado/protegido e não pode ser transcrito diretamente. Usa um link HLS sem DRM/encriptação ou cola a transcrição manualmente.");
  }

  const lines = text.split(/\r?\n/);
  // fMP4 init segment (present for Bunny fMP4 packaging)
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

  const initBytes = initUri
    ? new Uint8Array(await (await fetch(initUri)).arrayBuffer())
    : null;
  const isFmp4 = !!initBytes;

  const MAX = 20 * 1024 * 1024;
  // Transcrição de chunks em paralelo (ordem preservada pelo índice).
  const CHUNK_CONCURRENCY = 4;
  const SEGMENT_CONCURRENCY = 6;
  const pending: Promise<{ index: number; text: string }>[] = [];
  let chunkIndex = 0;
  let batch: Uint8Array[] = initBytes ? [initBytes] : [];
  let size = initBytes ? initBytes.byteLength : 0;

  const flush = async () => {
    const hasContent = batch.length > (initBytes ? 1 : 0);
    if (!hasContent) return;
    const out = concatBytes(batch);
    const index = chunkIndex++;
    batch = initBytes ? [initBytes] : [];
    size = initBytes ? initBytes.byteLength : 0;

    if (pending.length >= CHUNK_CONCURRENCY) {
      // Espera que o lote atual liberte espaço antes de somar mais trabalho.
      await Promise.race(pending);
    }

    const task = (async () => {
      const payload = isFmp4 ? out : await transmuxTsToAudioMp4(out);
      const t = await transcribeChunk(
        payload,
        isFmp4 ? "chunk.mp4" : "chunk.m4a",
        isFmp4 ? "video/mp4" : "audio/mp4",
        apiKey,
      );
      const trimmed = t.trim();
      if (!trimmed) {
        // Fail hard: um batch com áudio real tem de produzir texto. Caso contrário
        // marcaríamos como "concluída" com transcrição parcial. Deixa o cron reiniciar.
        throw new Error("Chunk HLS devolveu transcrição vazia — abortar para retry.");
      }
      return { index, text: trimmed };
    })();
    pending.push(task);
  };

  // Descarrega segmentos em paralelo mantendo a ordem original.
  for (let i = 0; i < segments.length; i += SEGMENT_CONCURRENCY) {
    const slice = segments.slice(i, i + SEGMENT_CONCURRENCY);
    const fetched = await Promise.all(
      slice.map(async (segUrl) => {
        const r = await fetch(segUrl);
        if (!r.ok) throw new Error(`Segmento HLS ${r.status}`);
        return new Uint8Array(await r.arrayBuffer());
      }),
    );
    for (const bytes of fetched) {
      if (size + bytes.byteLength > MAX && batch.length > (initBytes ? 1 : 0)) {
        await flush();
      }
      batch.push(bytes);
      size += bytes.byteLength;
    }
  }
  await flush();

  const settled = await Promise.all(pending);
  const texts = settled.sort((a, b) => a.index - b.index).map((s) => s.text);

  const combined = texts.join(" ").replace(/\s+/g, " ").trim();
  if (!combined) throw new Error("Nenhum segmento transcrito");
  return combined;
}

async function transcribeFromUrl(url: string, apiKey: string): Promise<string> {
  const mediaUrl = resolveDirectMediaUrl(url);

  // HLS path — chunk by segment so lessons of any duration can be transcribed
  // without hitting the 25MB per-request cap.
  if (/\.m3u8(\?|$)/i.test(mediaUrl)) {
    return transcribeFromHls(mediaUrl, apiKey);
  }

  // Direct file path (mp4/mp3/wav/…): single-shot upload up to 25MB.
  const media = await fetch(mediaUrl);
  if (!media.ok) {
    throw new Error(
      `Não consegui obter o vídeo (${media.status}). Usa URL directo (.mp4/.mp3/.m3u8) ou cola a transcrição manualmente.`,
    );
  }
  const contentType = (media.headers.get("content-type") ?? "").toLowerCase();
  const blob = await media.blob();

  if (
    contentType.includes("text/html") ||
    contentType.includes("application/xml") ||
    (!contentType.startsWith("audio/") &&
      !contentType.startsWith("video/") &&
      !contentType.includes("octet-stream"))
  ) {
    throw new Error(
      "O URL não é um ficheiro áudio/vídeo directo (parece uma página embed). Cola um link .mp4/.mp3/.m3u8 directo, ou cola a transcrição manualmente.",
    );
  }
  if (blob.size > 25 * 1024 * 1024) {
    throw new Error(
      "Ficheiro directo maior que 25MB. Usa antes o URL HLS (.m3u8) da mesma aula — é transcrito em pedaços automaticamente.",
    );
  }
  if (blob.size < 2048) {
    throw new Error("Ficheiro vazio ou demasiado pequeno. Verifica o URL.");
  }

  const ext =
    ({
      "audio/webm": "webm",
      "audio/mp4": "m4a",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/quicktime": "mov",
    } as Record<string, string>)[contentType.split(";")[0]] ??
    (mediaUrl.match(/\.(mp4|m4a|mp3|wav|webm|mov)(?:\?|$)/i)?.[1]?.toLowerCase() ?? "mp4");

  return transcribeChunk(new Uint8Array(await blob.arrayBuffer()), `lesson.${ext}`, contentType || "video/mp4", apiKey);
}

// -------- server functions --------

const IngestInput = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  courseTitle: z.string().optional(),
  lessonTitle: z.string().optional(),
  videoUrl: z.string().optional(),
  transcript: z.string().min(20),
  language: z.string().default("pt"),
});

export const ingestLessonTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => IngestInput.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const apiKey = requireAiKey();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Upsert transcript row
    const { data: row, error: upErr } = await supabaseAdmin
      .from("lesson_transcripts")
      .upsert(
        {
          course_id: data.courseId,
          lesson_id: data.lessonId,
          course_title: data.courseTitle ?? null,
          lesson_title: data.lessonTitle ?? null,
          video_url: data.videoUrl ?? null,
          transcript: data.transcript,
          language: data.language,
          status: "embedding",
          error: null,
          model: EMBEDDING_MODEL,
        },
        { onConflict: "course_id,lesson_id" },
      )
      .select("id")
      .single();
    if (upErr || !row) throw new Error(upErr?.message ?? "Falhou upsert de transcrição");

    // Chunk + embed
    const chunks = chunkText(data.transcript);
    if (!chunks.length) throw new Error("Transcrição demasiado curta");
    const embeddings = await embedBatch(chunks, apiKey);

    // Replace chunks for this transcript
    await supabaseAdmin.from("lesson_transcript_chunks").delete().eq("transcript_id", row.id);
    const rows = chunks.map((content, i) => ({
      transcript_id: row.id,
      course_id: data.courseId,
      lesson_id: data.lessonId,
      course_title: data.courseTitle ?? null,
      lesson_title: data.lessonTitle ?? null,
      chunk_index: i,
      content,
      embedding: embeddings[i] as unknown as string,
    }));
    // Insert in pages of 200 to stay well under any row/size limit
    for (let i = 0; i < rows.length; i += 200) {
      const slice = rows.slice(i, i + 200);
      const { error } = await supabaseAdmin.from("lesson_transcript_chunks").insert(slice);
      if (error) throw new Error(error.message);
    }
    await supabaseAdmin
      .from("lesson_transcripts")
      .update({ status: "ready", error: null })
      .eq("id", row.id);

    return { ok: true, chunks: chunks.length };
  });

const TranscribeInput = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  courseTitle: z.string().optional(),
  lessonTitle: z.string().optional(),
  videoUrl: z.string().url(),
  language: z.string().default("pt"),
});

export const transcribeLessonFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => TranscribeInput.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const apiKey = requireAiKey();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Mark as transcribing
    await supabaseAdmin.from("lesson_transcripts").upsert(
      {
        course_id: data.courseId,
        lesson_id: data.lessonId,
        course_title: data.courseTitle ?? null,
        lesson_title: data.lessonTitle ?? null,
        video_url: data.videoUrl,
        status: "transcribing",
        error: null,
        model: TRANSCRIBE_MODEL,
      },
      { onConflict: "course_id,lesson_id" },
    );

    try {
      const text = await transcribeFromUrl(data.videoUrl, apiKey);
      // Now ingest (reuse the same logic path)
      const result = await ingestLessonTranscript({
        data: {
          courseId: data.courseId,
          lessonId: data.lessonId,
          courseTitle: data.courseTitle,
          lessonTitle: data.lessonTitle,
          videoUrl: data.videoUrl,
          transcript: text,
          language: data.language,
        },
      });
      return { ok: true, transcript: text.slice(0, 500), chunks: result.chunks };
    } catch (e: any) {
      await supabaseAdmin
        .from("lesson_transcripts")
        .update({ status: "error", error: String(e?.message ?? e) })
        .eq("course_id", data.courseId)
        .eq("lesson_id", data.lessonId);
      throw e;
    }
  });

export const getLessonTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ courseId: z.string(), lessonId: z.string() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("lesson_transcripts")
      .select("status,transcript,language,updated_at,error,model")
      .eq("course_id", data.courseId)
      .eq("lesson_id", data.lessonId)
      .maybeSingle();
    return row ?? null;
  });

export const searchLessonKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ query: z.string().min(2), matchCount: z.number().int().min(1).max(12).default(6) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const apiKey = requireAiKey();
    const res = await fetch(`${GATEWAY}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: data.query }),
    });
    if (!res.ok) throw new Error(`Embeddings ${res.status}`);
    const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
    const emb = json.data[0]?.embedding;
    if (!emb) throw new Error("Sem embedding");

    const { data: matches, error } = await context.supabase.rpc("match_lesson_chunks", {
      query_embedding: emb as unknown as string,
      match_count: data.matchCount,
      min_similarity: 0.3,
    });
    if (error) throw new Error(error.message);
    return matches ?? [];
  });

// -------- background auto-transcription --------

/** Shared ingest logic reusable from server routes (no auth middleware). */
async function ingestTranscriptRaw(params: {
  courseId: string;
  lessonId: string;
  courseTitle?: string | null;
  lessonTitle?: string | null;
  videoUrl?: string | null;
  transcript: string;
  language?: string;
}) {
  const apiKey = requireAiKey();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: row, error: upErr } = await supabaseAdmin
    .from("lesson_transcripts")
    .upsert(
      {
        course_id: params.courseId,
        lesson_id: params.lessonId,
        course_title: params.courseTitle ?? null,
        lesson_title: params.lessonTitle ?? null,
        video_url: params.videoUrl ?? null,
        transcript: params.transcript,
        language: params.language ?? "pt",
        status: "embedding",
        error: null,
        model: EMBEDDING_MODEL,
      },
      { onConflict: "course_id,lesson_id" },
    )
    .select("id")
    .single();
  if (upErr || !row) throw new Error(upErr?.message ?? "Falhou upsert de transcrição");

  const chunks = chunkText(params.transcript);
  if (!chunks.length) throw new Error("Transcrição demasiado curta");
  const embeddings = await embedBatch(chunks, apiKey);

  await supabaseAdmin.from("lesson_transcript_chunks").delete().eq("transcript_id", row.id);
  const rows = chunks.map((content, i) => ({
    transcript_id: row.id,
    course_id: params.courseId,
    lesson_id: params.lessonId,
    course_title: params.courseTitle ?? null,
    lesson_title: params.lessonTitle ?? null,
    chunk_index: i,
    content,
    embedding: embeddings[i] as unknown as string,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const slice = rows.slice(i, i + 200);
    const { error } = await supabaseAdmin.from("lesson_transcript_chunks").insert(slice);
    if (error) throw new Error(error.message);
  }
  await supabaseAdmin
    .from("lesson_transcripts")
    .update({ status: "ready", error: null })
    .eq("id", row.id);
  return { chunks: chunks.length };
}

/**
 * Picks the next lesson (with a videoUrl set via admin overrides) that
 * has no transcript yet — or has failed — and transcribes it. Uses a
 * simple lock via `status = 'transcribing'` to avoid concurrent workers.
 * Returns a small summary the cron/route can log.
 */
export async function runAutoTranscribeTick(): Promise<{
  ok: boolean;
  skipped?: string;
  processed?: { courseId: string; lessonId: string; chars: number };
  error?: string;
}> {
  const apiKey = requireAiKey();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Lock: if another worker is currently transcribing (within last 20min), skip.
  const lockCutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const { data: inFlight } = await supabaseAdmin
    .from("lesson_transcripts")
    .select("course_id,lesson_id,updated_at")
    .eq("status", "transcribing")
    .gte("updated_at", lockCutoff)
    .limit(1);
  if (inFlight && inFlight.length > 0) {
    return { ok: true, skipped: "another lesson is being transcribed" };
  }

  // Load course overrides (video URLs + titles live here).
  const { data: ov } = await supabaseAdmin
    .from("admin_overrides")
    .select("data")
    .eq("id", "courses")
    .maybeSingle();
  const overrides = (ov?.data ?? {}) as {
    courses?: Record<string, { title?: string }>;
    modulesByCourse?: Record<
      string,
      Array<{ lessons: Array<{ id: string; title?: string; videoUrl?: string }> }>
    >;
  };
  const modulesByCourse = overrides.modulesByCourse ?? {};

  // Build candidate list (courseId, lessonId, title, url).
  type Candidate = {
    courseId: string;
    lessonId: string;
    courseTitle: string | null;
    lessonTitle: string | null;
    videoUrl: string;
  };
  const candidates: Candidate[] = [];
  for (const [courseId, mods] of Object.entries(modulesByCourse)) {
    const courseTitle = overrides.courses?.[courseId]?.title ?? null;
    for (const m of mods ?? []) {
      for (const l of m.lessons ?? []) {
        if (l.videoUrl && /^https?:\/\//i.test(l.videoUrl)) {
          candidates.push({
            courseId,
            lessonId: l.id,
            courseTitle,
            lessonTitle: l.title ?? null,
            videoUrl: l.videoUrl,
          });
        }
      }
    }
  }
  if (candidates.length === 0) return { ok: true, skipped: "no lessons with videoUrl" };

  // Filter out anything already ready/embedding/transcribing, and honour a
  // short cooldown on failed rows (retry, mas não em loop apertado).
  const { data: existing } = await supabaseAdmin
    .from("lesson_transcripts")
    .select("course_id,lesson_id,status,updated_at")
    .in(
      "lesson_id",
      candidates.map((c) => c.lessonId),
    );
  const ERROR_COOLDOWN_MS = 5 * 60 * 1000;
  const now = Date.now();
  const skip = new Set<string>();
  const STALE_LOCK_MS = 20 * 60 * 1000;
  for (const r of (existing ?? []) as any[]) {
    const key = `${r.course_id}::${r.lesson_id}`;
    const ts = r.updated_at ? new Date(r.updated_at).getTime() : 0;
    if (r.status === "ready") {
      skip.add(key);
    } else if (r.status === "embedding" || r.status === "transcribing") {
      // Reclama locks presos: se um worker morreu a meio (timeout), a linha
      // ficava "transcribing" para sempre e a aula nunca era transcrita.
      if (now - ts < STALE_LOCK_MS) skip.add(key);
    } else if (r.status === "error") {
      if (now - ts < ERROR_COOLDOWN_MS) skip.add(key);
    }
  }

  // Prioriza aulas em "error" ou com lock preso (retomar primeiro), depois novas.
  const errorSet = new Set(
    (existing ?? [])
      .filter((r: any) => r.status === "error" || r.status === "transcribing" || r.status === "embedding")
      .map((r: any) => `${r.course_id}::${r.lesson_id}`),
  );

  const eligible = candidates.filter((c) => !skip.has(`${c.courseId}::${c.lessonId}`));
  eligible.sort((a, b) => {
    const ae = errorSet.has(`${a.courseId}::${a.lessonId}`) ? 0 : 1;
    const be = errorSet.has(`${b.courseId}::${b.lessonId}`) ? 0 : 1;
    return ae - be;
  });
  const next = eligible[0];
  if (!next) return { ok: true, skipped: "all lessons transcribed or in cooldown" };

  // Mark as transcribing (acts as lock).
  await supabaseAdmin.from("lesson_transcripts").upsert(
    {
      course_id: next.courseId,
      lesson_id: next.lessonId,
      course_title: next.courseTitle,
      lesson_title: next.lessonTitle,
      video_url: next.videoUrl,
      status: "transcribing",
      error: null,
      model: TRANSCRIBE_MODEL,
    },
    { onConflict: "course_id,lesson_id" },
  );

  try {
    const text = await transcribeFromUrl(next.videoUrl, apiKey);
    await ingestTranscriptRaw({
      courseId: next.courseId,
      lessonId: next.lessonId,
      courseTitle: next.courseTitle,
      lessonTitle: next.lessonTitle,
      videoUrl: next.videoUrl,
      transcript: text,
    });
    return {
      ok: true,
      processed: { courseId: next.courseId, lessonId: next.lessonId, chars: text.length },
    };
  } catch (e: any) {
    await supabaseAdmin
      .from("lesson_transcripts")
      .update({ status: "error", error: String(e?.message ?? e) })
      .eq("course_id", next.courseId)
      .eq("lesson_id", next.lessonId);
    return { ok: false, error: String(e?.message ?? e) };
  }
}

