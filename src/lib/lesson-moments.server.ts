/**
 * Pesquisa semântica nos momentos das aulas (server-only).
 *
 * Devolve blocos de contexto com curso, aula, minuto exacto e link profundo
 * (/academia/<courseId>/<lessonId>?t=<segundos>) para que os agentes de suporte
 * possam dizer *em que aula e em que minuto* o assunto foi falado.
 */
const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

export type LessonMoment = {
  course_id: string;
  lesson_id: string;
  course_title: string | null;
  lesson_title: string | null;
  content: string;
  start_seconds: number | null;
  similarity: number;
};

/** mm:ss (ou h:mm:ss) a partir de segundos. */
export function formatTimecode(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.floor(seconds ?? 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

export function lessonMomentLink(m: LessonMoment): string {
  const t = Math.max(0, Math.floor(m.start_seconds ?? 0));
  return `/academia/${m.course_id}/${m.lesson_id}${t > 3 ? `?t=${t}` : ""}`;
}

/** Momentos das aulas mais relevantes para a pergunta. */
export async function searchLessonMoments(
  query: string,
  apiKey: string,
  matchCount = 6,
): Promise<LessonMoment[]> {
  const q = query.trim();
  if (q.length < 4) return [];
  try {
    const res = await fetch(`${GATEWAY}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: q.slice(0, 4000) }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: Array<{ embedding: number[] }> };
    const emb = json.data?.[0]?.embedding;
    if (!emb) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.rpc("match_lesson_moments", {
      query_embedding: emb as unknown as string,
      match_count: matchCount,
      min_similarity: 0.3,
    });
    return Array.isArray(data) ? (data as LessonMoment[]) : [];
  } catch (err) {
    console.error("[lesson-moments] search failed", err);
    return [];
  }
}

/** Bloco de contexto pronto a injectar no system prompt de um agente. */
export async function lessonMomentsContext(query: string, apiKey: string): Promise<string> {
  const moments = await searchLessonMoments(query, apiKey);
  if (moments.length === 0) return "";

  const blocks = moments
    .map((m, i) => {
      const label = [m.course_title, m.lesson_title].filter(Boolean).join(" · ") || "Aula";
      return [
        `[${i + 1}] ${label} — minuto ${formatTimecode(m.start_seconds)}`,
        `Link: ${lessonMomentLink(m)}`,
        `Transcrição: ${m.content.slice(0, 900)}`,
      ].join("\n");
    })
    .join("\n\n");

  return `\n\nMomentos reais das aulas do MM Club relevantes para a pergunta (transcrições com o minuto exacto).
Usa isto para dizer em que AULA e em que MINUTO o assunto foi falado, e dá sempre o link markdown clicável já com o minuto, ex: [Nome da aula (12:40)](/academia/curso/aula?t=760).
Nunca inventes aulas nem minutos: usa só os que estão aqui.

${blocks}`;
}
