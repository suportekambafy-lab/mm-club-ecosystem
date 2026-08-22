/**
 * Geração das perguntas do teste de módulo a partir das transcrições reais
 * das aulas. Server-only: chama o gateway de IA da plataforma.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "google/gemini-3.6-flash";

export type GeneratedQuestion = {
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
  lesson_id: string | null;
  lesson_title: string | null;
  start_seconds: number | null;
};

export type TranscriptSource = {
  lessonId: string;
  lessonTitle: string;
  transcript: string;
};

function clampText(text: string, max: number) {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export async function generateModuleQuestions(opts: {
  apiKey: string;
  moduleTitle: string;
  courseTitle: string;
  sources: TranscriptSource[];
  count: number;
}): Promise<GeneratedQuestion[]> {
  const { apiKey, moduleTitle, courseTitle, sources, count } = opts;
  if (!sources.length) return [];

  // Orçamento de contexto: reparte ~4000 caracteres por aula (máx. 40k).
  const perLesson = Math.max(1200, Math.floor(40000 / sources.length));
  const context = sources
    .map(
      (s, i) =>
        `### Aula ${i + 1} — id: ${s.lessonId} — título: ${s.lessonTitle}\n${clampText(
          s.transcript,
          perLesson,
        )}`,
    )
    .join("\n\n");

  const system = [
    "És um designer instrucional do MM Club, uma academia de negócios em português de Portugal.",
    "Crias perguntas de escolha múltipla que testam compreensão real e memorização do conteúdo das aulas.",
    "Regras:",
    "- Cada pergunta tem exactamente 4 opções, apenas 1 correcta.",
    "- As perguntas devem ser respondíveis SÓ com o conteúdo das transcrições fornecidas. Nada inventado.",
    "- Evita perguntas triviais sobre palavras exactas; testa conceitos, passos, critérios e decisões.",
    "- As opções erradas devem ser plausíveis (erros comuns), nunca absurdas.",
    "- A explicação tem 1 a 2 frases e diz porque a resposta certa está certa.",
    "- Indica sempre o lesson_id da aula de onde vem a pergunta.",
    "- Escreve em português de Portugal, tom directo e profissional.",
  ].join("\n");

  const user = [
    `Curso: ${courseTitle}`,
    `Módulo: ${moduleTitle}`,
    `Gera exactamente ${count} perguntas distintas, distribuídas pelas aulas disponíveis.`,
    "",
    "Responde apenas com JSON no formato:",
    '{"questions":[{"prompt":"...","options":["a","b","c","d"],"correct_index":0,"explanation":"...","lesson_id":"...","start_seconds":null}]}',
    "",
    "Transcrições:",
    context,
  ].join("\n");

  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gateway ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = json.choices?.[0]?.message?.content ?? "";
  const parsed = safeParse(raw);
  const titleById = new Map(sources.map((s) => [s.lessonId, s.lessonTitle]));

  const out: GeneratedQuestion[] = [];
  for (const q of parsed) {
    const prompt = String(q?.prompt ?? "").trim();
    const options = Array.isArray(q?.options)
      ? q.options.map((o: unknown) => String(o ?? "").trim()).filter(Boolean)
      : [];
    const correct = Number(q?.correct_index);
    if (!prompt || options.length !== 4) continue;
    if (!Number.isInteger(correct) || correct < 0 || correct > 3) continue;
    const lessonId = q?.lesson_id ? String(q.lesson_id) : null;
    const start = Number(q?.start_seconds);
    out.push({
      prompt,
      options,
      correct_index: correct,
      explanation: String(q?.explanation ?? "").trim(),
      lesson_id: lessonId && titleById.has(lessonId) ? lessonId : null,
      lesson_title: lessonId ? (titleById.get(lessonId) ?? null) : null,
      start_seconds: Number.isFinite(start) && start > 0 ? start : null,
    });
  }
  return out;
}

function safeParse(raw: string): any[] {
  const attempt = (text: string) => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };
  let data = attempt(raw);
  if (!data) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) data = attempt(match[0]);
  }
  if (!data) return [];
  const list = Array.isArray(data) ? data : (data.questions ?? data.perguntas ?? []);
  return Array.isArray(list) ? list : [];
}
