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

function resolveDirectMediaUrl(input: string): string {
  // Limpa espaços acidentais colados no URL (ex.: ".../ embed/?v=...").
  const url = (input ?? "").replace(/\s+/g, "").trim();

  // Bunny Stream iframe embed → direct HLS playlist via pull zone env var.
  const m = url.match(/iframe\.mediadelivery\.net\/(?:embed|play)\/(\d+)\/([0-9a-f-]{36})/i);
  if (m) {
    const guid = m[2];
    const pullZone = process.env.VITE_BUNNY_PULL_ZONE || process.env.BUNNY_PULL_ZONE;
    if (pullZone) {
      return `https://${pullZone}.b-cdn.net/${guid}/playlist.m3u8`;
    }
  }

  // Panda Video embed → HLS directo no CDN de entrega (b-vz-<zona>).
  //  player-vz-<zona>.tv.pandavideo.com.br/embed/?v=<id>
  //  player.pandavideo.com.br/embed/?v=<id>  (sem zona → não resolvível)
  //  → https://b-vz-<zona>.tv.pandavideo.com.br/<id>/playlist.m3u8
  if (/pandavideo\.com(?:\.br)?/i.test(url) && !/\.(m3u8|mp4|mp3|m4a|webm|mov)(?:\?|$)/i.test(url)) {
    let parsed: URL | undefined;
    try {
      parsed = new URL(url);
    } catch {
      parsed = undefined;
    }
    const videoId =
      parsed?.searchParams.get("v")?.match(/[0-9a-f-]{8,}/i)?.[0] ??
      url.match(/[?&]v=([0-9a-f-]{8,})/i)?.[1] ??
      url.match(/videos\/([0-9a-f-]{8,})/i)?.[1];
    const zone =
      parsed?.hostname.match(/^(?:player|b)-vz-(.+?)\.tv\.pandavideo\.com\.br$/i)?.[1] ??
      process.env.PANDA_DELIVERY_ZONE;
    if (videoId && zone) {
      return `https://b-vz-${zone}.tv.pandavideo.com.br/${videoId}/playlist.m3u8`;
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


/**
 * Minuto aproximado de cada bloco da transcrição.
 *
 * As transcrições são texto corrido (sem timestamps do modelo), por isso
 * estimamos a posição temporal pelo número de caracteres já falados —
 * ~15 caracteres por segundo em português falado. Dá um minuto próximo o
 * suficiente para o membro saltar directamente para a parte certa da aula.
 */
const CHARS_PER_SECOND = 15;

export function estimateChunkTimings(
  chunks: string[],
  durationSeconds?: number | null,
): Array<{ start: number; end: number }> {
  const totalChars = chunks.reduce((a, c) => a + c.length, 0) || 1;
  const totalSeconds =
    durationSeconds && durationSeconds > 0 ? durationSeconds : totalChars / CHARS_PER_SECOND;
  const out: Array<{ start: number; end: number }> = [];
  let offset = 0;
  for (const c of chunks) {
    const start = (offset / totalChars) * totalSeconds;
    offset += c.length;
    const end = (offset / totalChars) * totalSeconds;
    out.push({ start: Math.floor(start), end: Math.ceil(end) });
  }
  return out;
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
    const timings = estimateChunkTimings(chunks);
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
      start_seconds: timings[i]?.start ?? null,
      end_seconds: timings[i]?.end ?? null,
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

/** Lightweight polling endpoint: transcription progress for one lesson. */
export const getLessonTranscriptStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ courseId: z.string(), lessonId: z.string() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("lesson_transcripts")
      .select("status,error,updated_at")
      .eq("course_id", data.courseId)
      .eq("lesson_id", data.lessonId)
      .maybeSingle();
    if (!row) return null;
    const m = /progresso\s+(\d+)\s*\/\s*(\d+)/i.exec(String(row.error ?? ""));
    return {
      status: row.status as string,
      updatedAt: row.updated_at as string | null,
      done: m ? Number(m[1]) : null,
      total: m ? Number(m[2]) : null,
      partsPerTick: 4,
    };
  });

/** Pesquisa semântica nas transcrições, com o minuto exato de cada resultado. */
export const searchLessonMoments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        query: z.string().min(2).max(200),
        matchCount: z.number().int().min(1).max(20).default(12),
      })
      .parse(raw),
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

    const { data: matches, error } = await context.supabase.rpc("match_lesson_moments", {
      query_embedding: emb as unknown as string,
      match_count: data.matchCount,
      min_similarity: 0.22,
    });
    if (error) throw new Error(error.message);

    return (matches ?? []).map((m: any) => ({
      id: String(m.id),
      courseId: String(m.course_id),
      lessonId: String(m.lesson_id),
      courseTitle: (m.course_title as string | null) ?? null,
      lessonTitle: (m.lesson_title as string | null) ?? null,
      content: String(m.content ?? ""),
      startSeconds: m.start_seconds == null ? null : Number(m.start_seconds),
      similarity: Number(m.similarity ?? 0),
    }));
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
  const timings = estimateChunkTimings(chunks);
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
    start_seconds: timings[i]?.start ?? null,
    end_seconds: timings[i]?.end ?? null,
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
const MAX_PARALLEL_LESSONS = 3;

export async function runAutoTranscribeTick(): Promise<{
  ok: boolean;
  skipped?: string;
  processed?: { courseId: string; lessonId: string; chars: number };
  results?: Array<{
    courseId: string;
    lessonId: string;
    ok: boolean;
    chars?: number;
    error?: string;
    partial?: boolean;
    progress?: string;
  }>;

  error?: string;
}> {
  const apiKey = requireAiKey();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Lock por concorrência: até MAX_PARALLEL_LESSONS aulas em voo ao mesmo tempo.
  const lockCutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const { data: inFlight } = await supabaseAdmin
    .from("lesson_transcripts")
    .select("course_id,lesson_id,updated_at")
    .eq("status", "transcribing")
    .gte("updated_at", lockCutoff);
  const freeSlots = MAX_PARALLEL_LESSONS - (inFlight?.length ?? 0);
  if (freeSlots <= 0) {
    return { ok: true, skipped: "transcription workers busy" };
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
  const STALE_LOCK_MS = 3 * 60 * 1000;
  const PARTIAL_COOLDOWN_MS = 60 * 1000;
  for (const r of (existing ?? []) as any[]) {
    const key = `${r.course_id}::${r.lesson_id}`;
    const ts = r.updated_at ? new Date(r.updated_at).getTime() : 0;
    if (r.status === "ready" || r.status === "skipped") {
      // "skipped": posta de parte manualmente (ou URL não suportado). Nunca
      // volta à fila até um admin premir "Retomar".
      skip.add(key);
    } else if (r.status === "partial") {
      // Aula longa a ser transcrita por partes: retoma quase de imediato,
      // só evitamos dois workers em cima da mesma aula no mesmo minuto.
      if (now - ts < PARTIAL_COOLDOWN_MS) skip.add(key);
    } else if (r.status === "embedding" || r.status === "transcribing") {
      // Reclama locks presos: se um worker morreu a meio (timeout), a linha
      // ficava "transcribing" para sempre e a aula nunca era transcrita.
      if (now - ts < STALE_LOCK_MS) skip.add(key);
    } else if (r.status === "error") {
      if (now - ts < ERROR_COOLDOWN_MS) skip.add(key);
    }
  }


  // Prioriza aulas já começadas (partial/error/lock preso), depois novas.
  const errorSet = new Set(
    (existing ?? [])
      .filter((r: any) =>
        ["partial", "error", "transcribing", "embedding"].includes(r.status),
      )
      .map((r: any) => `${r.course_id}::${r.lesson_id}`),
  );


  const eligible = candidates.filter((c) => !skip.has(`${c.courseId}::${c.lessonId}`));
  eligible.sort((a, b) => {
    const ae = errorSet.has(`${a.courseId}::${a.lessonId}`) ? 0 : 1;
    const be = errorSet.has(`${b.courseId}::${b.lessonId}`) ? 0 : 1;
    return ae - be;
  });
  const batchToRun = eligible.slice(0, freeSlots);
  if (!batchToRun.length)
    return { ok: true, skipped: "all lessons transcribed or in cooldown" };

  // Marca todas como "transcribing" (lock) antes de arrancar em paralelo.
  await supabaseAdmin.from("lesson_transcripts").upsert(
    batchToRun.map((c) => ({
      course_id: c.courseId,
      lesson_id: c.lessonId,
      course_title: c.courseTitle,
      lesson_title: c.lessonTitle,
      video_url: resolveDirectMediaUrl(c.videoUrl),
      status: "transcribing",
      error: null,
      model: TRANSCRIBE_MODEL,
    })),
    { onConflict: "course_id,lesson_id" },
  );

  const results = await Promise.all(
    batchToRun.map(async (item) => {
      try {
        const mediaUrl = resolveDirectMediaUrl(item.videoUrl);
        let text: string;

        if (/\.m3u8(\?|$)/i.test(mediaUrl)) {
          // Aulas longas (2-3h): transcreve por partes e retoma no próximo
          // ciclo, em vez de tentar tudo numa só execução (que estourava o
          // tempo do worker e recomeçava do zero para sempre).
          const { transcribeLessonResumable } = await import("@/lib/lesson-transcribe.server");
          const res = await transcribeLessonResumable({
            courseId: item.courseId,
            lessonId: item.lessonId,
            playlistUrl: mediaUrl,
            apiKey,
          });
          if (!res.done) {
            await supabaseAdmin
              .from("lesson_transcripts")
              .update({
                status: "partial",
                error: `progresso ${res.completedParts}/${res.totalParts}`,
              })
              .eq("course_id", item.courseId)
              .eq("lesson_id", item.lessonId);
            return {
              courseId: item.courseId,
              lessonId: item.lessonId,
              ok: true,
              partial: true,
              progress: `${res.completedParts}/${res.totalParts}`,
              chars: 0,
            };
          }
          text = res.transcript;
        } else {
          text = await transcribeFromUrl(item.videoUrl, apiKey);
        }

        await ingestTranscriptRaw({
          courseId: item.courseId,
          lessonId: item.lessonId,
          courseTitle: item.courseTitle,
          lessonTitle: item.lessonTitle,
          videoUrl: item.videoUrl,
          transcript: text,
        });
        return {
          courseId: item.courseId,
          lessonId: item.lessonId,
          ok: true,
          chars: text.length,
        };
      } catch (e: any) {
        const error = String(e?.message ?? e);
        // Falhas permanentes (URL embed, sem media directo) não devem ficar a
        // ocupar slots da fila em loop — ficam de parte até intervenção.
        const permanent = /não é um ficheiro áudio\/vídeo directo|Não consegui obter o vídeo/i.test(
          error,
        );
        await supabaseAdmin
          .from("lesson_transcripts")
          .update({ status: permanent ? "skipped" : "error", error })
          .eq("course_id", item.courseId)
          .eq("lesson_id", item.lessonId);
        return { courseId: item.courseId, lessonId: item.lessonId, ok: false, error };
      }
    }),
  );



  const first = results.find((r) => r.ok);
  return {
    ok: results.some((r) => r.ok),
    results,
    processed: first
      ? { courseId: first.courseId, lessonId: first.lessonId, chars: first.chars ?? 0 }
      : undefined,
    error: results.every((r) => !r.ok) ? results[0]?.error : undefined,
  };
}


// -------- admin queue controls (skip / finalize partial / resume) --------

const QueueActionInput = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  keepPartial: z.boolean().optional(),
});

/**
 * Põe uma aula de parte na fila de transcrição. Se já existirem partes
 * transcritas (aulas longas), com `keepPartial` guardamos a transcrição até
 * onde a IA conseguiu e marcamos como concluída; caso contrário fica
 * simplesmente "skipped" e deixa de ocupar workers.
 */
export const skipLessonTranscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => QueueActionInput.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: parts } = await supabaseAdmin
      .from("lesson_transcript_parts")
      .select("part_index,text")
      .eq("course_id", data.courseId)
      .eq("lesson_id", data.lessonId);

    const rows = ((parts ?? []) as Array<{ part_index: number; text: string }>).sort(
      (a, b) => a.part_index - b.part_index,
    );
    const partial = rows
      .map((r) => r.text ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (data.keepPartial && partial.length > 200) {
      const { data: meta } = await supabaseAdmin
        .from("lesson_transcripts")
        .select("course_title,lesson_title,video_url")
        .eq("course_id", data.courseId)
        .eq("lesson_id", data.lessonId)
        .maybeSingle();
      await ingestTranscriptRaw({
        courseId: data.courseId,
        lessonId: data.lessonId,
        courseTitle: (meta as any)?.course_title ?? null,
        lessonTitle: (meta as any)?.lesson_title ?? null,
        videoUrl: (meta as any)?.video_url ?? null,
        transcript: partial,
      });
      await supabaseAdmin
        .from("lesson_transcripts")
        .update({ error: `parcial: ${rows.length} parte(s) transcritas` })
        .eq("course_id", data.courseId)
        .eq("lesson_id", data.lessonId);
      await supabaseAdmin
        .from("lesson_transcript_parts")
        .delete()
        .eq("course_id", data.courseId)
        .eq("lesson_id", data.lessonId);
      return { ok: true, finalized: true, chars: partial.length };
    }

    await supabaseAdmin.from("lesson_transcripts").upsert(
      {
        course_id: data.courseId,
        lesson_id: data.lessonId,
        status: "skipped",
        error: "posta de parte manualmente",
      },
      { onConflict: "course_id,lesson_id" },
    );
    return { ok: true, finalized: false, chars: 0 };
  });

/** Volta a colocar a aula na fila (limpa lock/erro/skip). */
export const resumeLessonTranscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => QueueActionInput.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("lesson_transcripts")
      .update({ status: "pending", error: null })
      .eq("course_id", data.courseId)
      .eq("lesson_id", data.lessonId);
    return { ok: true };
  });
