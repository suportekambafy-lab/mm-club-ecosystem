// MM Studio — geração da bíblia de consistência + controlo de qualidade (QC)
// automático antes da entrega. Server-only.
import type { ConsistencyLock } from "./studio-consistency";

const TEXT_MODEL = "google/gemini-3.1-flash-lite";
const GEMINI_QC_MODEL = "gemini-2.5-flash";
const MAX_QC_BYTES = 18 * 1024 * 1024; // acima disto salta-se o QC visual

// ---------------------------------------------------------------- lock

export async function generateConsistencyLock(input: {
  people: string;
  style: string;
  objective?: string | null;
  scene?: string | null;
  notes?: string | null;
  brand?: { brand_name?: string | null; tone?: string | null; audience?: string | null } | null;
  product?: { name?: string | null; category?: string | null; notes?: string | null } | null;
}): Promise<ConsistencyLock | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;

  const wantsPeople = input.people && input.people !== "none";

  const brief = [
    `Style: ${input.style}.`,
    input.objective ? `Objective: ${input.objective}.` : "",
    input.scene ? `Scene mode: ${input.scene}.` : "",
    wantsPeople ? `Cast preset: ${input.people}.` : "No people in frame.",
    input.brand?.brand_name ? `Brand: ${input.brand.brand_name}.` : "",
    input.brand?.tone ? `Brand tone: ${input.brand.tone}.` : "",
    input.brand?.audience ? `Audience: ${input.brand.audience}.` : "",
    input.product?.name ? `Product: ${input.product.name} (${input.product.category ?? "n/a"}).` : "",
    input.product?.notes ? `Product notes: ${input.product.notes}.` : "",
    input.notes ? `Creative direction: ${input.notes}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const system =
    "You are an art director writing a CONTINUITY BIBLE for an AI-generated advertising film. " +
    "Return ONLY compact JSON with concrete, unambiguous visual facts (exact colours, materials, hair, nail polish colour, accessories). " +
    "Never leave a field vague like 'stylish' or 'modern'. If there are no people, omit the character object entirely.";

  const schemaHint = `{"character":{"ethnicity":"","skin_tone":"","eye_color":"","hair":"","apparent_age":"","build":"","makeup":"","nails":"","tattoos":"","accessories":"","wardrobe":"","footwear":""},"scene":{"environment":"","time_of_day":"","light_direction":"","light_temperature":"","palette":"","lens":""},"product":{"description":""}}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Brief: ${brief}\n\nReturn JSON exactly in this shape (fill every relevant field, json output):\n${schemaHint}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(stripFences(raw)) as ConsistencyLock;
    if (!wantsPeople) delete parsed.character;
    return parsed;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ narration

export async function generateNarrationScript(input: {
  localeDirective: string;
  duration: number;
  objective?: string | null;
  brand?: { brand_name?: string | null; tone?: string | null } | null;
  product?: { name?: string | null } | null;
  notes?: string | null;
}): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const words = Math.max(8, Math.round(input.duration * 2.3));
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You write short, high-conversion advertising voice-over scripts. Return ONLY the spoken words, no scene directions, no quotes, no markdown.",
          },
          {
            role: "user",
            content: [
              `Language: ${input.localeDirective}`,
              `Total video length: ${input.duration} seconds — script must fit in about ${words} words when spoken at natural pace.`,
              input.objective ? `Objective: ${input.objective}.` : "",
              input.product?.name ? `Product: ${input.product.name}.` : "",
              input.brand?.brand_name ? `Brand: ${input.brand.brand_name}.` : "",
              input.brand?.tone ? `Tone: ${input.brand.tone}.` : "",
              input.notes ? `Creative direction: ${input.notes}.` : "",
              "Structure: hook, desire, close. End with a short call to action.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim();
    return text ? text.replace(/^["']|["']$/g, "").slice(0, 800) : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ QC

export type QcCheck = {
  id: string;
  ok: boolean;
  severity: "critical" | "major" | "minor";
  confidence: number; // 0..1
  detail?: string;
};

export type QcReport = {
  verdict: "passed" | "warned" | "failed";
  checks: QcCheck[];
  /** Índices de segmentos com falha técnica/grave e alta confiança. */
  badSegments: number[];
  skipped?: string;
};

export type QcRequirements = {
  narration: boolean;
  captions: boolean;
  music: boolean;
  hasPeople: boolean;
  expectedSegments: number;
};

/**
 * Analisa os vídeos gerados. Verificações técnicas são determinísticas;
 * as visuais usam um modelo multimodal e só contam com confiança elevada.
 */
export async function runVideoQc(
  segmentUrls: string[],
  req: QcRequirements,
): Promise<QcReport> {
  const checks: QcCheck[] = [];
  const badSegments: number[] = [];

  // --- técnicas ---
  checks.push({
    id: "segments_complete",
    ok: segmentUrls.length === req.expectedSegments,
    severity: "critical",
    confidence: 1,
    detail: `${segmentUrls.length}/${req.expectedSegments} segmentos prontos.`,
  });

  const bytesList: Array<Uint8Array | null> = [];
  for (let i = 0; i < segmentUrls.length; i++) {
    let bytes: Uint8Array | null = null;
    try {
      const r = await fetch(segmentUrls[i]);
      if (r.ok) bytes = new Uint8Array(await r.arrayBuffer());
    } catch {
      bytes = null;
    }
    bytesList.push(bytes);
    const valid = !!bytes && bytes.byteLength > 40_000;
    checks.push({
      id: `file_valid_${i}`,
      ok: valid,
      severity: "critical",
      confidence: 1,
      detail: valid ? `${Math.round((bytes!.byteLength / 1024 / 1024) * 10) / 10} MB` : "Ficheiro em falta ou corrompido.",
    });
    if (!valid) badSegments.push(i);
  }

  const key = process.env.GEMINI_API_KEY;
  const first = bytesList.find((b) => b && b.byteLength < MAX_QC_BYTES) ?? null;

  if (!key || !first) {
    return {
      verdict: checks.every((c) => c.ok) ? "passed" : "failed",
      checks,
      badSegments,
      skipped: !key ? "QC visual indisponível (sem chave)." : "Vídeo demasiado grande para QC visual.",
    };
  }

  const visual = await analyseWithGemini(key, first, req);
  if (visual) {
    checks.push(...visual.checks);
    // Só segmentos com falha crítica e confiança alta entram em regeneração.
    const criticalFail = visual.checks.some(
      (c) => !c.ok && c.severity === "critical" && c.confidence >= 0.75,
    );
    if (criticalFail) {
      const idx = bytesList.findIndex((b) => b === first);
      if (idx >= 0 && !badSegments.includes(idx)) badSegments.push(idx);
    }
  }

  const anyCriticalFail = checks.some((c) => !c.ok && c.severity === "critical" && c.confidence >= 0.75);
  const anyOtherFail = checks.some((c) => !c.ok);
  return {
    verdict: anyCriticalFail ? "failed" : anyOtherFail ? "warned" : "passed",
    checks,
    badSegments,
  };
}

async function analyseWithGemini(
  key: string,
  bytes: Uint8Array,
  req: QcRequirements,
): Promise<{ checks: QcCheck[] } | null> {
  const question = [
    "You are a strict QC inspector for AI-generated advertising video. Watch the clip and answer with JSON only.",
    "Report ONLY objective, obvious defects — never subjective creative taste.",
    "Fields:",
    '{"has_spoken_narration":bool,"has_burned_in_captions":bool,"has_music":bool,',
    '"character_consistent":bool,"anatomy_ok":bool,"text_legible":bool,"motion_smooth":bool,"framing_stable":bool,',
    '"audio_video_synced":bool,"confidence":0..1,"notes":"short"}',
    req.hasPeople ? "There should be a person on screen; check identity, wardrobe, nails, accessories stay identical." : "There are no people; set character_consistent and anatomy_ok to true.",
  ].join(" ");

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_QC_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType: "video/mp4", data: toB64(bytes) } },
                { text: question },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!raw) return null;
    const r = JSON.parse(stripFences(raw)) as Record<string, unknown>;
    const conf = typeof r.confidence === "number" ? Math.min(1, Math.max(0, r.confidence)) : 0.6;
    const notes = typeof r.notes === "string" ? r.notes.slice(0, 240) : undefined;
    const checks: QcCheck[] = [];

    if (req.narration) {
      checks.push({
        id: "narration_present",
        ok: r.has_spoken_narration !== false,
        severity: "critical",
        confidence: conf,
        detail: "Narração pedida pelo utilizador.",
      });
    }
    if (req.captions) {
      checks.push({
        id: "captions_present",
        ok: r.has_burned_in_captions !== false,
        severity: "critical",
        confidence: conf,
        detail: "Legendas pedidas pelo utilizador.",
      });
    }
    if (req.music) {
      checks.push({ id: "music_present", ok: r.has_music !== false, severity: "minor", confidence: conf });
    }
    checks.push(
      { id: "character_consistent", ok: r.character_consistent !== false, severity: "critical", confidence: conf, detail: notes },
      { id: "anatomy_ok", ok: r.anatomy_ok !== false, severity: "critical", confidence: conf },
      { id: "text_legible", ok: r.text_legible !== false, severity: "major", confidence: conf },
      { id: "motion_smooth", ok: r.motion_smooth !== false, severity: "major", confidence: conf },
      { id: "framing_stable", ok: r.framing_stable !== false, severity: "major", confidence: conf },
      { id: "audio_video_synced", ok: r.audio_video_synced !== false, severity: "major", confidence: conf },
    );
    return { checks };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------- budget

export const DEFAULT_MONTHLY_ABSORBED_LIMIT = 20000;

type MinimalSupabase = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (col: string, v: unknown) => { maybeSingle: () => Promise<{ data: unknown }> };
      gte: (col: string, v: string) => Promise<{ data: unknown }>;
    };
  };
};

/** Créditos já absorvidos pelo MM Club no mês corrente vs limite configurado. */
export async function absorbedBudget(supabase: MinimalSupabase): Promise<{ used: number; limit: number; allowed: boolean }> {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  let limit = DEFAULT_MONTHLY_ABSORBED_LIMIT;
  try {
    const { data } = await supabase
      .from("billing_settings")
      .select("value")
      .eq("key", "studio_qc_monthly_absorbed_credits")
      .maybeSingle();
    const v = (data as { value?: { limit?: number } } | null)?.value?.limit;
    if (typeof v === "number") limit = v;
  } catch {
    /* usa o default */
  }

  let used = 0;
  try {
    const { data } = await supabase
      .from("mm_studio_qc_log")
      .select("credits_absorbed")
      .gte("created_at", startOfMonth.toISOString());
    for (const row of (data as Array<{ credits_absorbed?: number }> | null) ?? []) {
      used += row.credits_absorbed ?? 0;
    }
  } catch {
    /* ignora */
  }

  return { used, limit, allowed: used < limit };
}

// ------------------------------------------------------------- helpers

function stripFences(s: string): string {
  return s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

function toB64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
