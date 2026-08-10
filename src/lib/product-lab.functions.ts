import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PL_CRITERIA, PL_MAX_NOTE, computeScore } from "./product-lab-config";

const STATUSES = ["found", "analysis", "validated", "testing", "winner", "rejected"] as const;

const nullableText = (max: number) => z.string().max(max).nullable().optional();

const ProductSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  image_url: nullableText(2000),
  category: nullableText(120),
  status: z.enum(STATUSES).default("found"),
  sell_price: z.number().nonnegative().nullable().optional(),
  cost_price: z.number().nonnegative().nullable().optional(),
  market: nullableText(120),
  supplier: nullableText(200),
  supplier_url: nullableText(2000),
  source: nullableText(80),
  product_url: nullableText(2000),
  ad_url: nullableText(2000),
  notes: nullableText(4000),
});

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("pl_products")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { products: data ?? [] };
  });

export const getProduct = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pid = data.id;
    const [p, scores, analyses, assets, competitors, notes, history] = await Promise.all([
      supabase.from("pl_products").select("*").eq("id", pid).eq("user_id", userId).maybeSingle(),
      supabase.from("pl_product_scores").select("*").eq("product_id", pid),
      supabase.from("pl_ai_analyses").select("*").eq("product_id", pid).order("created_at", { ascending: false }),
      supabase.from("pl_creative_assets").select("*").eq("product_id", pid).order("created_at", { ascending: false }),
      supabase.from("pl_competitors").select("*").eq("product_id", pid).order("created_at", { ascending: false }),
      supabase.from("pl_product_notes").select("*").eq("product_id", pid).order("created_at", { ascending: false }),
      supabase.from("pl_product_history").select("*").eq("product_id", pid).order("created_at", { ascending: false }).limit(50),
    ]);
    if (!p.data) throw new Error("Produto não encontrado");
    return {
      product: p.data,
      scores: scores.data ?? [],
      analyses: analyses.data ?? [],
      assets: assets.data ?? [],
      competitors: competitors.data ?? [],
      notes: notes.data ?? [],
      history: history.data ?? [],
    };
  });

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => ProductSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...fields } = data;
    if (id) {
      const { error } = await supabase.from("pl_products").update(fields).eq("id", id).eq("user_id", userId);
      if (error) throw new Error(error.message);
      await supabase.from("pl_product_history").insert({ product_id: id, user_id: userId, event: "updated", detail: "Informações atualizadas" });
      return { id };
    }
    const { data: row, error } = await supabase
      .from("pl_products")
      .insert({ ...fields, user_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("pl_product_history").insert({ product_id: row.id, user_id: userId, event: "created", detail: "Produto adicionado" });
    return { id: row.id as string };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("pl_products")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setProductStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid(), status: z.enum(STATUSES) }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("pl_products")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    await supabase.from("pl_product_history").insert({
      product_id: data.id,
      user_id: userId,
      event: "status",
      detail: data.status,
    });
    return { ok: true };
  });

const criterionIds = PL_CRITERIA.map((c) => c.id);

export const saveScores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        values: z.record(z.string(), z.number().min(0).max(PL_MAX_NOTE)),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const entries = Object.entries(data.values).filter(([k]) => criterionIds.includes(k));
    if (entries.length) {
      const { error } = await supabase.from("pl_product_scores").upsert(
        entries.map(([criterion, value]) => ({
          product_id: data.id,
          user_id: userId,
          criterion,
          value: Math.round(value),
        })),
        { onConflict: "product_id,criterion" },
      );
      if (error) throw new Error(error.message);
    }
    const score = computeScore(Object.fromEntries(entries));
    await supabase.from("pl_products").update({ score }).eq("id", data.id).eq("user_id", userId);
    return { score };
  });

// ============ CREATIVE VAULT ============
const AssetSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  kind: z.enum(["image", "video", "link", "screenshot"]).default("image"),
  url: nullableText(2000),
  title: nullableText(200),
  notes: nullableText(2000),
});

export const saveAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => AssetSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...fields } = data;
    if (id) {
      const { error } = await supabase.from("pl_creative_assets").update(fields).eq("id", id).eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await supabase.from("pl_creative_assets").insert({ ...fields, user_id: userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("pl_creative_assets")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ CONCORRENTES ============
const CompetitorSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  url: nullableText(2000),
  screenshot_url: nullableText(2000),
  notes: nullableText(2000),
});

export const saveCompetitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => CompetitorSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...fields } = data;
    if (id) {
      const { error } = await supabase.from("pl_competitors").update(fields).eq("id", id).eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await supabase.from("pl_competitors").insert({ ...fields, user_id: userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCompetitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("pl_competitors")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ OBSERVAÇÕES ============
export const addNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ product_id: z.string().uuid(), body: z.string().min(1).max(4000) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("pl_product_notes")
      .insert({ ...data, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("pl_product_notes")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ ANÁLISE IA ============
export const analyseProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: product } = await supabase
      .from("pl_products")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!product) throw new Error("Produto não encontrado");

    const [{ data: scores }, { data: notes }, { data: competitors }] = await Promise.all([
      supabase.from("pl_product_scores").select("criterion, value").eq("product_id", data.id),
      supabase.from("pl_product_notes").select("body").eq("product_id", data.id).limit(20),
      supabase.from("pl_competitors").select("name, url").eq("product_id", data.id).limit(20),
    ]);

    const criteriaText = PL_CRITERIA.map((c) => {
      const v = (scores ?? []).find((s) => s.criterion === c.id)?.value;
      return `- ${c.label}: ${v ?? "sem nota"}/${PL_MAX_NOTE}`;
    }).join("\n");

    const margin =
      product.sell_price != null && product.cost_price != null
        ? `${(Number(product.sell_price) - Number(product.cost_price)).toFixed(2)} € (${Math.round(
            ((Number(product.sell_price) - Number(product.cost_price)) / Math.max(Number(product.sell_price), 0.01)) * 100,
          )}%)`
        : "não indicada";

    const prompt = [
      `Produto: ${product.name}`,
      `Categoria/nicho: ${product.category ?? "não indicada"}`,
      `Preço de venda: ${product.sell_price ?? "não indicado"}`,
      `Custo estimado: ${product.cost_price ?? "não indicado"}`,
      `Margem: ${margin}`,
      `Mercado/país: ${product.market ?? "não indicado"}`,
      `Fornecedor: ${product.supplier ?? "não indicado"}`,
      `Onde encontrou: ${product.source ?? "não indicado"}`,
      `Link do produto: ${product.product_url ?? "—"}`,
      `Link do anúncio/criativo: ${product.ad_url ?? "—"}`,
      `Concorrentes: ${(competitors ?? []).map((c) => `${c.name}${c.url ? ` (${c.url})` : ""}`).join("; ") || "—"}`,
      "",
      "Critérios MM avaliados pelo membro:",
      criteriaText,
      "",
      `Observações do membro: ${[product.notes, ...(notes ?? []).map((n) => n.body)].filter(Boolean).join(" | ") || "—"}`,
    ].join("\n");

    const system = [
      "És um analista sénior de produtos de e-commerce e dropshipping do MM Club.",
      "Escreve em português de Portugal (AO90), tratamento por 'tu', tom premium, direto e sem hype.",
      "Nunca garantas resultados nem afirmes que um produto vai vender. Apresenta sempre como apoio à decisão.",
      "Responde em markdown, exatamente com estas secções e por esta ordem:",
      "### Resumo da oportunidade",
      "### Pontos fortes",
      "### Pontos de atenção",
      "### Potencial de criativos",
      "### Público provável",
      "### Ângulos possíveis",
      "### Recomendação",
      "Na secção Recomendação escreve apenas uma destas frases, isolada na primeira linha: 'Vale a pena aprofundar', 'Precisa de mais validação' ou 'Baixo potencial neste momento', seguida de uma justificação curta.",
    ].join("\n");

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("IA indisponível neste momento.");

    const model = "google/gemini-3.6-flash";
    const { streamText } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const result = streamText({ model: gateway(model), system, prompt });
    const content = await result.text;

    const rec = /Vale a pena aprofundar|Precisa de mais validação|Baixo potencial neste momento/.exec(content);

    const { data: row, error } = await supabase
      .from("pl_ai_analyses")
      .insert({
        product_id: data.id,
        user_id: userId,
        model,
        content,
        recommendation: rec?.[0] ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("pl_product_history").insert({
      product_id: data.id,
      user_id: userId,
      event: "ai",
      detail: rec?.[0] ?? "Análise gerada",
    });

    return { analysis: row };
  });
