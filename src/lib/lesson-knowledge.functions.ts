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
  // Bunny Stream iframe embed → direct MP4 via pull zone env var, if defined.
  const m = url.match(/iframe\.mediadelivery\.net\/(?:embed|play)\/(\d+)\/([0-9a-f-]{36})/i);
  if (m) {
    const guid = m[2];
    const pullZone = process.env.VITE_BUNNY_PULL_ZONE || process.env.BUNNY_PULL_ZONE;
    if (pullZone) {
      return `https://${pullZone}.b-cdn.net/${guid}/play_720p.mp4`;
    }
  }
  return url;
}

async function transcribeFromUrl(url: string, apiKey: string): Promise<string> {
  const mediaUrl = resolveDirectMediaUrl(url);
  const media = await fetch(mediaUrl);
  if (!media.ok) {
    throw new Error(
      `Não consegui obter o vídeo (${media.status}). Usa URL directo (.mp4/.mp3) ou cola a transcrição manualmente.`,
    );
  }
  const contentType = (media.headers.get("content-type") ?? "").toLowerCase();
  const blob = await media.blob();

  // Reject HTML/embed pages — the transcription model can't decode them.
  if (
    contentType.includes("text/html") ||
    contentType.includes("application/xml") ||
    (!contentType.startsWith("audio/") &&
      !contentType.startsWith("video/") &&
      !contentType.includes("octet-stream"))
  ) {
    throw new Error(
      "O URL não é um ficheiro áudio/vídeo directo (parece uma página embed). Cola um link .mp4/.mp3 directo, ou cola a transcrição manualmente.",
    );
  }

  if (blob.size > 25 * 1024 * 1024) {
    throw new Error(
      "Ficheiro maior que 25MB. Para aulas longas, cola a transcrição manualmente.",
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

  const form = new FormData();
  form.append("model", TRANSCRIBE_MODEL);
  form.append("file", blob, `lesson.${ext}`);

  const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { "Lovable-API-Key": apiKey },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Transcrição ${res.status}: ${body.slice(0, 400)}`);
  }
  const json = (await res.json()) as { text?: string };
  if (!json.text) throw new Error("Resposta de transcrição sem texto");
  return json.text;
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
