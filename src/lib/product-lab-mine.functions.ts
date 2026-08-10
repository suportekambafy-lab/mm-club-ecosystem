import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PL_CRITERIA, PL_MAX_NOTE, computeScore } from "./product-lab-config";

const criterionIds = PL_CRITERIA.map((c) => c.id);

// Tolerante de propósito: o modelo pode omitir campos sem informação.
const nullableStr = z.string().nullish().default(null);

const MineSchema = z.object({
  name: nullableStr,
  category: nullableStr,
  description: nullableStr,
  price: nullableStr,
  currency: nullableStr,
  market: nullableStr,
  store: nullableStr,
  supplier: nullableStr,
  source: nullableStr,
  image_url: nullableStr,
  problem: nullableStr,
  audience: nullableStr,
  benefits: nullableStr,
  analysis: z.string().nullish().default(""),
  scores: z.record(z.string(), z.number()).nullish().default({}),
});

export type MinedDraft = z.infer<typeof MineSchema>;

const RECS = ["Vale a pena aprofundar", "Precisa de mais validação", "Baixo potencial neste momento"] as const;

const SYSTEM = [
  "És um analista sénior de mineração de produtos de e-commerce e dropshipping do MM Club.",
  "Escreve em português de Portugal (AO90), tratamento por 'tu', tom premium, direto e sem hype.",
  "REGRA CRÍTICA: nunca inventes dados. Se um campo não estiver claramente disponível na informação fornecida, devolve null nesse campo.",
  "Nunca inventes preço, moeda, fornecedor, margem, loja ou mercado.",
  "Nunca garantas resultados nem digas que o produto vai vender. É apoio à decisão.",
  "O campo 'analysis' deve ser markdown exatamente com estas secções e por esta ordem:",
  "### Resumo da oportunidade",
  "### Pontos fortes",
  "### Pontos de atenção",
  "### Potencial de criativos",
  "### Público provável",
  "### Ângulos possíveis",
  "### Recomendação",
  `Na secção Recomendação escreve apenas uma destas frases isolada na primeira linha: ${RECS.map((r) => `'${r}'`).join(", ")}, seguida de uma justificação curta.`,
  "Quando não houver informação suficiente para uma secção, escreve 'Não identificado — precisa de confirmação'.",
  `No campo 'scores' dá uma nota de 0 a ${PL_MAX_NOTE} apenas para estes critérios MM (não inventes outros): ${criterionIds.join(", ")}.`,
  "Se não tiveres base para avaliar um critério, omite-o em vez de adivinhar.",
].join("\n");

async function runMining(prompt: string, imageUrl: string | null) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("IA indisponível neste momento.");

  const model = "google/gemini-3.6-flash";
  const { streamText, Output, NoObjectGeneratedError } = await import("ai");
  const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
  const gateway = createLovableAiGatewayProvider(key);

  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  if (imageUrl) content.push({ type: "image", image: new URL(imageUrl) });

  try {
    const result = streamText({
      model: gateway(model),
      system: SYSTEM,
      messages: [{ role: "user", content: content as never }],
      output: Output.object({ schema: MineSchema }),
    });
    const output = (await result.output) as MinedDraft;
    return { output, model };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new Error("A análise não ficou completa. Confirma ou preenche os dados manualmente.");
    }
    throw error;
  }
}

function sanitize(draft: MinedDraft) {
  const clean = (v: string | null | undefined) => {
    const s = (v ?? "").trim();
    if (!s) return null;
    if (/^(n\/?a|null|não identificado|nao identificado|desconhecido|—|-)$/i.test(s)) return null;
    return s.slice(0, 1800);
  };
  const scores: Record<string, number> = {};
  for (const [k, v] of Object.entries(draft.scores ?? {})) {
    if (!criterionIds.includes(k)) continue;
    if (typeof v !== "number" || Number.isNaN(v)) continue;
    scores[k] = Math.max(0, Math.min(PL_MAX_NOTE, Math.round(v)));
  }
  const rec = RECS.find((r) => draft.analysis?.includes(r)) ?? null;
  return {
    draft: {
      name: clean(draft.name),
      category: clean(draft.category),
      description: clean(draft.description),
      price: clean(draft.price),
      currency: clean(draft.currency),
      market: clean(draft.market),
      store: clean(draft.store),
      supplier: clean(draft.supplier),
      source: clean(draft.source),
      image_url: clean(draft.image_url),
      problem: clean(draft.problem),
      audience: clean(draft.audience),
      benefits: clean(draft.benefits),
    },
    analysis: draft.analysis ?? "",
    recommendation: rec,
    scores,
    score: computeScore(scores),
  };
}

/** Mineração por URL: recolhe sinais da página e pede análise à IA. */
export const mineFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ url: z.string().min(4).max(2000) }).parse(v))
  .handler(async ({ data }) => {
    const { normalizeProductUrl, fetchPageSignals } = await import("./product-lab-mine.server");
    const url = normalizeProductUrl(data.url);
    if (!url) {
      return {
        ok: false as const,
        partial: true,
        notice: "Esse link não parece válido. Confirma o endereço ou adiciona manualmente.",
        result: null,
      };
    }

    const signals = await fetchPageSignals(url);
    const prompt = [
      "Analisa esta oportunidade de produto a partir da informação recolhida na página.",
      `URL: ${url}`,
      `Domínio/loja: ${signals.host || "não identificado"}`,
      `Nome do site (meta): ${signals.siteName ?? "não identificado"}`,
      `Título (meta): ${signals.title ?? "não identificado"}`,
      `Descrição (meta): ${signals.description ?? "não identificada"}`,
      `Imagem principal (meta): ${signals.image ?? "não identificada"}`,
      `Preço (meta): ${signals.price ?? "não identificado"}`,
      `Moeda (meta): ${signals.currency ?? "não identificada"}`,
      signals.jsonLd ? `Dados estruturados (JSON-LD):\n${signals.jsonLd}` : "Dados estruturados: nenhum",
      "",
      "Conteúdo textual da página (pode estar truncado):",
      signals.text || "(sem conteúdo legível)",
      "",
      "Preenche image_url apenas com um URL de imagem presente na informação acima. Deixa null se não existir.",
    ].join("\n");

    if (!signals.ok) {
      // Sem conteúdo legível: ainda tentamos ler o URL, mas avisamos que é parcial.
      const fallback = await runMining(
        [
          "A página não permitiu leitura automática do conteúdo.",
          `URL: ${url}`,
          `Domínio: ${signals.host}`,
          "Não inventes dados. Devolve null em tudo o que não for dedutível com segurança a partir do URL,",
          "e nas secções da análise indica claramente o que precisa de confirmação manual.",
        ].join("\n"),
        null,
      );
      const clean = sanitize(fallback.output);
      return {
        ok: true as const,
        partial: true,
        notice:
          "Não conseguimos obter todas as informações deste link. Não há problema — confirma ou adiciona manualmente os dados que faltam.",
        result: {
          ...clean,
          model: fallback.model,
          draft: {
            ...clean.draft,
            product_url: url,
            store: clean.draft.store ?? signals.host ?? null,
          },
        },
      };
    }

    const run = await runMining(prompt, null);
    const clean = sanitize(run.output);
    const draft = {
      ...clean.draft,
      product_url: url,
      image_url: clean.draft.image_url ?? signals.image ?? null,
      store: clean.draft.store ?? signals.siteName ?? signals.host ?? null,
      name: clean.draft.name ?? signals.title ?? null,
    };
    const missing = ["name", "category", "price", "image_url"].filter(
      (k) => !(draft as Record<string, unknown>)[k],
    );
    return {
      ok: true as const,
      partial: missing.length > 0,
      notice:
        missing.length > 0
          ? "Não conseguimos obter todas as informações deste link. Confirma ou adiciona manualmente os dados que faltam."
          : null,
      result: { ...clean, draft, model: run.model },
    };
  });

/** Mineração por imagem/screenshot já carregada no storage. */
export const mineFromImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ image_url: z.string().url().max(2000) }).parse(v))
  .handler(async ({ data }) => {
    const prompt = [
      "Analisa esta imagem (pode ser screenshot de produto, anúncio, loja ou vídeo social).",
      "Identifica apenas o que estiver visível ou claramente dedutível da imagem.",
      "Se o nome, marca ou preço não estiverem visíveis, devolve null nesses campos.",
      "Preenche image_url com null (a imagem já está guardada).",
    ].join("\n");

    const run = await runMining(prompt, data.image_url);
    const clean = sanitize(run.output);
    const draft = { ...clean.draft, image_url: data.image_url, product_url: null as string | null };
    const missing = ["name", "category", "price"].filter((k) => !(draft as Record<string, unknown>)[k]);
    return {
      ok: true as const,
      partial: missing.length > 0,
      notice:
        missing.length > 0
          ? "A imagem não tinha toda a informação. Confirma ou completa o que falta."
          : null,
      result: { ...clean, draft, model: run.model },
    };
  });

const SaveSchema = z.object({
  name: z.string().min(1).max(200),
  image_url: z.string().max(2000).nullable().optional(),
  category: z.string().max(120).nullable().optional(),
  sell_price: z.number().nonnegative().nullable().optional(),
  market: z.string().max(120).nullable().optional(),
  supplier: z.string().max(200).nullable().optional(),
  source: z.string().max(80).nullable().optional(),
  product_url: z.string().max(2000).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  scores: z.record(z.string(), z.number()).optional(),
  analysis: z.string().max(20000).optional(),
  recommendation: z.string().max(120).nullable().optional(),
  model: z.string().max(120).optional(),
});

/** Guarda o produto minerado com score, análise IA e histórico, em "Em análise". */
export const saveMinedProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => SaveSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { scores = {}, analysis, recommendation, model, ...fields } = data;

    const entries = Object.entries(scores).filter(([k]) => criterionIds.includes(k));
    const score = computeScore(Object.fromEntries(entries));

    const { data: row, error } = await supabase
      .from("pl_products")
      .insert({ ...fields, status: "analysis", score, user_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const id = row.id as string;

    if (entries.length) {
      await supabase.from("pl_product_scores").upsert(
        entries.map(([criterion, value]) => ({
          product_id: id,
          user_id: userId,
          criterion,
          value: Math.round(value),
        })),
        { onConflict: "product_id,criterion" },
      );
    }

    if (analysis && analysis.trim()) {
      await supabase.from("pl_ai_analyses").insert({
        product_id: id,
        user_id: userId,
        model: model ?? "google/gemini-3.6-flash",
        content: analysis,
        recommendation: recommendation ?? null,
      });
    }

    await supabase.from("pl_product_history").insert({
      product_id: id,
      user_id: userId,
      event: "created",
      detail: "Produto minerado com IA",
    });

    return { id };
  });
