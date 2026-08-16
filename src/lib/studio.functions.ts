import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STUDIO_COSTS, IMAGE_FORMATS, videoSegments, type ImageFormat, type ImageStyle, type PeoplePreset, type SceneMode, type ConversionHook, type VideoStyle, type VideoFormat } from "./studio-config";
import { buildImagePrompt, buildVideoPrompt, type BrandDna, type ProductCtx } from "./studio-prompt";
import { consistencyBlock, pickContinuityStrategy, type ConsistencyLock } from "./studio-consistency";
import { localeDirective, normalizeLegacyLocale, normalizeLegacyVoice, VOICE_GENDERS } from "./studio-languages";


const BUCKET = "studio-media";

// ============ CONTEXT ============
export const getStudioContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [creditsRes, brandRes, productsRes] = await Promise.all([
      supabase.from("mm_studio_credits").select("balance, lifetime_granted, lifetime_spent").eq("user_id", userId).maybeSingle(),
      supabase.from("mm_studio_brand").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("mm_studio_products").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);

    // Auto-provision an EMPTY credits row: the welcome bonus is only granted
    // after the first confirmed paid invoice (trials start at zero).
    let credits = creditsRes.data;
    if (!credits) {
      const { data } = await supabase
        .from("mm_studio_credits")
        .insert({ user_id: userId, balance: 0, lifetime_granted: 0 })
        .select("balance, lifetime_granted, lifetime_spent")
        .maybeSingle();
      credits = data ?? { balance: 0, lifetime_granted: 0, lifetime_spent: 0 };
    }

    return {
      credits: credits ?? { balance: 0, lifetime_granted: 0, lifetime_spent: 0 },
      brand: brandRes.data ?? null,
      products: productsRes.data ?? [],
    };
  });

// ============ BRAND DNA ============
const BrandSchema = z.object({
  brand_name: z.string().max(120).nullable().optional(),
  logo_url: z.string().max(2000).nullable().optional(),
  colors: z.array(z.string().max(32)).max(8).default([]),
  typography: z.string().max(200).nullable().optional(),
  segment: z.string().max(200).nullable().optional(),
  audience: z.string().max(500).nullable().optional(),
  tone: z.string().max(300).nullable().optional(),
  website: z.string().max(500).nullable().optional(),
  socials: z.record(z.string(), z.string().max(500)).default({}),
  description: z.string().max(2000).nullable().optional(),
});

export const saveBrandDna = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => BrandSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("mm_studio_brand")
      .upsert({ user_id: userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ PRODUCTS ============
const ProductSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(160),
  category: z.string().max(120).nullable().optional(),
  logo_url: z.string().max(2000).nullable().optional(),
  brand_colors: z.array(z.string().max(32)).max(8).default([]),
  photos: z.array(z.string().max(2000)).max(20).default([]),
  notes: z.string().max(2000).nullable().optional(),
});

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => ProductSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = { ...data, user_id: userId };
    if (data.id) {
      const { error } = await supabase.from("mm_studio_products").update(payload).eq("id", data.id).eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase.from("mm_studio_products").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("mm_studio_products").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ IMAGE GENERATION ============
const GenerateImagesSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  style: z.string().min(1),
  format: z.string().min(1),
  scene: z.enum(["ecommerce_white", "ecommerce_black", "ecommerce_gradient", "studio_seamless", "lifestyle", "editorial", "outdoor"]).optional(),
  people: z.enum(["none", "man", "woman", "couple", "group", "hands"]).default("none"),
  hook: z.enum(["none", "problem_solution", "before_after", "social_proof", "scarcity", "curiosity", "aspiration"]).default("none"),
  notes: z.string().max(1000).optional(),
  count: z.number().int().min(1).max(4).default(4),
});

const OPENAI_IMAGE_MODEL = "gpt-image-2";
const OPENAI_IMAGE_QUALITY = "high";

const MAX_REF_BYTES = 15 * 1024 * 1024;

/**
 * Only reference images hosted on this project's own storage domain may be
 * fetched server-side. Anything else (internal hosts, cloud metadata IPs,
 * arbitrary third-party URLs) is rejected to prevent SSRF.
 */
function assertAllowedReferenceUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("URL de imagem inválida.");
  }
  if (parsed.protocol !== "https:") throw new Error("URL de imagem inválida.");

  const allowedHosts = new Set<string>();
  for (const base of [process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL]) {
    if (!base) continue;
    try {
      allowedHosts.add(new URL(base).hostname.toLowerCase());
    } catch {
      /* ignore malformed env */
    }
  }
  if (!allowedHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error("Imagem de referência fora do armazenamento permitido.");
  }
  return parsed;
}

async function fetchAsBytes(url: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const safe = assertAllowedReferenceUrl(url);
  const r = await fetch(safe.toString(), {
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`Não consegui carregar imagem de referência (${r.status}).`);
  const mime = (r.headers.get("content-type") ?? "image/png").split(";")[0].trim();
  if (!mime.startsWith("image/")) {
    throw new Error("Referência não é uma imagem.");
  }
  const buf = await r.arrayBuffer();
  if (buf.byteLength > MAX_REF_BYTES) {
    throw new Error("Imagem de referência demasiado grande.");
  }
  return { bytes: new Uint8Array(buf), mime };
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

const GEMINI_IMAGE_MODEL = "google/gemini-3.1-flash-image";

function isModerationError(status: number, body: string): boolean {
  const b = body.toLowerCase();
  return (
    status === 400 &&
    (b.includes("content_policy_violation") ||
      b.includes("moderation_blocked") ||
      b.includes("safety system") ||
      b.includes("rejected as a result of our safety"))
  );
}

/** Conta OpenAI sem saldo / limite de faturação atingido → usamos o motor alternativo. */
function isBillingError(status: number, body: string): boolean {
  const b = body.toLowerCase();
  return (
    (status === 400 || status === 402 || status === 429) &&
    (b.includes("billing_hard_limit_reached") ||
      b.includes("billing hard limit") ||
      b.includes("billing_limit") ||
      b.includes("insufficient_quota") ||
      b.includes("quota"))
  );
}

/**
 * Fallback: quando a OpenAI recusa o prompt por moderação (roupa justa, biquíni,
 * fitness, mais pele visível), geramos com o Gemini via Lovable AI, que tem
 * política diferente para moda/beachwear.
 */
async function callGeminiImageModel(
  prompt: string,
  refs: { bytes: Uint8Array; mime: string }[] = [],
  opts: { safetySuffix?: boolean } = {},
): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Fallback de imagem indisponível (LOVABLE_API_KEY não configurada).");

  const suffix =
    opts.safetySuffix === false
      ? ""
      : " Tasteful, professional advertising photography. Non-explicit, commercial catalogue standard suitable for fashion, swimwear, fitness and bodycare brands.";
  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `${prompt}${suffix}`,
    },
  ];
  for (const r of refs.slice(0, 3)) {
    content.push({ type: "image_url", image_url: { url: `data:${r.mime};base64,${bytesToB64(r.bytes)}` } });
  }


  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: {
      "Lovable-API-Key": key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GEMINI_IMAGE_MODEL,
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Limite de pedidos atingido no gerador alternativo. Tenta daqui a pouco.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados no gerador alternativo.");
    throw new Error(`Gerador alternativo falhou (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("O gerador alternativo não devolveu imagem.");
  return b64;
}

async function callOpenAiImage(
  key: string,
  prompt: string,
  size: string,
  refs: { bytes: Uint8Array; mime: string }[],
): Promise<Response> {
  if (refs.length > 0) {
    // Image edit — usa o produto como referência real (mantém identidade).
    const form = new FormData();
    form.append("model", OPENAI_IMAGE_MODEL);
    form.append("prompt", prompt);
    form.append("size", size);
    form.append("quality", OPENAI_IMAGE_QUALITY);
    form.append("n", "1");
    refs.slice(0, 4).forEach((r, i) => {
      const ext = r.mime.includes("jpeg") ? "jpg" : r.mime.includes("webp") ? "webp" : "png";
      const blob = new Blob([r.bytes as unknown as BlobPart], { type: r.mime });
      form.append("image[]", blob, `ref-${i}.${ext}`);
    });
    return fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
  }
  return fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt,
      size,
      quality: OPENAI_IMAGE_QUALITY,
      n: 1,
    }),
  });
}

async function callImageModel(
  prompt: string,
  size: string,
  refs: { bytes: Uint8Array; mime: string }[] = [],
): Promise<string> {
  // Cadeia de contas OpenAI: quando a primeira fica sem crédito/limite, passa à
  // seguinte; se todas falharem por faturação, o motor alternativo assume.
  const keys = [process.env.OPENAI_API_KEY, process.env.OPENAI_API_KEY_FALLBACK].filter(
    (k): k is string => Boolean(k),
  );
  if (keys.length === 0) {
    throw new Error("OPENAI_API_KEY não configurada. Adiciona a chave nos secrets do backend.");
  }

  let lastBilling = false;
  let lastError = "";
  let lastStatus = 0;

  for (const key of keys) {
    const res = await callOpenAiImage(key, prompt, size, refs);

    if (res.ok) {
      const json = (await res.json()) as { data?: { b64_json?: string }[] };
      const b64 = json.data?.[0]?.b64_json;
      if (!b64) throw new Error("Resposta inesperada da OpenAI.");
      return b64;
    }

    const text = await res.text().catch(() => "");
    if (isModerationError(res.status, text)) {
      // Moda/biquíni/fitness: a OpenAI bloqueia, o Gemini gera.
      return callGeminiImageModel(prompt, refs);
    }

    lastStatus = res.status;
    lastError = text;
    lastBilling = isBillingError(res.status, text) || res.status === 401;
    if (!lastBilling) break; // erro real do pedido: não vale tentar outra conta
  }

  if (lastBilling) {
    // Todas as contas OpenAI sem crédito: motor alternativo (Lovable AI).
    return callGeminiImageModel(prompt, refs);
  }
  if (lastStatus === 429) {
    throw new Error("OpenAI recusou o pedido (rate limit). Tenta novamente daqui a pouco.");
  }
  throw new Error(`OpenAI ${lastStatus}: ${lastError.slice(0, 240)}`);
}


export const generateImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => GenerateImagesSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const count = data.count ?? 4;
    const cost = count * STUDIO_COSTS.imageSingle;

    // Load brand + product
    const [brandRes, productRes] = await Promise.all([
      supabase.from("mm_studio_brand").select("*").eq("user_id", userId).maybeSingle(),
      data.productId
        ? supabase.from("mm_studio_products").select("*").eq("id", data.productId).eq("user_id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const brand = brandRes.data as unknown as BrandDna;
    const product = productRes.data as unknown as ProductCtx;

    // Format lookup
    const fmt = IMAGE_FORMATS.find((f) => f.id === (data.format as ImageFormat));
    if (!fmt) throw new Error("Formato inválido.");

    // Spend upfront
    const { data: newBal, error: spendErr } = await supabase.rpc("mm_studio_spend_credits", {
      _user_id: userId,
      _amount: cost,
      _reason: "image_generation",
    });
    if (spendErr) {
      if (String(spendErr.message).includes("insufficient_credits")) {
        throw new Error("Créditos insuficientes. Compra mais créditos para continuar.");
      }
      throw new Error(spendErr.message);
    }

    // Bíblia de consistência partilhada por todas as variações do lote.
    const { generateConsistencyLock } = await import("./studio-qc.server");
    const imageLock = await generateConsistencyLock({
      people: data.people,
      style: data.style,
      scene: data.scene,
      notes: data.notes,
      brand,
      product,
    });

    const prompt = buildImagePrompt({
      style: data.style as ImageStyle,
      format: data.format as ImageFormat,
      scene: data.scene as SceneMode | undefined,
      people: data.people as PeoplePreset,
      hook: data.hook as ConversionHook,
      brand,
      product,
      notes: data.notes,
      consistency: consistencyBlock(imageLock),
    });


    // Carregar fotos do produto como referência real (mantém identidade visual).
    const productPhotos = ((product as { photos?: string[] } | null)?.photos ?? []).slice(0, 3);
    const refs: { bytes: Uint8Array; mime: string }[] = [];
    for (const url of productPhotos) {
      try {
        refs.push(await fetchAsBytes(url));
      } catch {
        // ignora referência falhada; continua com as que carregaram
      }
    }
    const refPrompt = refs.length > 0
      ? `${prompt} Use the attached reference image(s) as the EXACT product — preserve shape, colours, label, packaging and proportions faithfully. Recompose it in the new scene; do not invent a different product.`
      : prompt;

    const generateOne = async (i: number) => {
      const b64 = await callImageModel(refPrompt, fmt.size, refs);
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const path = `${userId}/images/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.png`;
      const up = await supabase.storage.from(BUCKET).upload(path, bytes, {
        contentType: "image/png",
        upsert: false,
      });
      if (up.error) throw new Error(up.error.message);
      const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signed.error || !signed.data) throw new Error(signed.error?.message ?? "URL falhou");
      const url = signed.data.signedUrl;
      const { data: asset, error: aErr } = await supabase
        .from("mm_studio_assets")
        .insert({
          user_id: userId,
          kind: "image",
          url,
          thumb_url: url,
          format: data.format,
          style: data.style,
          product_id: data.productId ?? null,
          credits_used: STUDIO_COSTS.imageSingle,
          metadata: { prompt, size: fmt.size, model: OPENAI_IMAGE_MODEL, storage_path: path },
        })
        .select("id, url")
        .single();
      if (aErr) throw new Error(aErr.message);
      return { id: asset.id, url: asset.url };
    };

    const results = await Promise.allSettled(Array.from({ length: count }, (_, i) => generateOne(i)));
    const generated: { id: string; url: string }[] = [];
    let firstError: unknown = null;
    for (const r of results) {
      if (r.status === "fulfilled") generated.push(r.value);
      else if (!firstError) firstError = r.reason;
    }

    // Refund unsucceeded
    const refund = (count - generated.length) * STUDIO_COSTS.imageSingle;
    let finalBalance = newBal as number;
    if (refund > 0) {
      const { data: refunded } = await supabase.rpc("mm_studio_refund_credits", {
        _user_id: userId,
        _amount: refund,
        _reason: "image_generation_refund",
      });
      if (typeof refunded === "number") finalBalance = refunded;
    }

    if (generated.length === 0) {
      throw firstError instanceof Error ? firstError : new Error("Falha ao gerar imagens.");
    }

    return { assets: generated, balance: finalBalance, cost: cost - refund };
  });

// ============ VIDEO GENERATION (Gemini Omni Flash) ============
const OMNI_MODEL = "gemini-omni-flash-preview";

const StartVideoSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  style: z.string().min(1),
  format: z.enum(["reels", "tiktok", "facebook", "stories", "shorts"]),
  duration: z.number().int().refine((d) => [8, 10, 15, 30].includes(d), "Duração inválida.").default(8),
  objective: z.string().max(120).optional(),
  people: z.enum(["none", "man", "woman", "couple", "group", "hands"]).default("none"),
  hook: z.enum(["none", "problem_solution", "before_after", "social_proof", "scarcity", "curiosity", "aspiration"]).default("none"),
  notes: z.string().max(1200).optional(),
  // Aceita valores antigos (`pt`, `male_pt`) e novos (`pt-PT`).
  captions: z.string().default("none"),
  captionsLocale: z.string().optional(),
  captionText: z.string().max(300).optional(),
  narration: z.string().default("none"),
  narrationLocale: z.string().optional(),
  narrationScript: z.string().max(800).optional(),
  music: z.enum(["none", "cinematic", "upbeat", "elegant", "epic", "chill", "corporate"]).default("none"),
  /** Força geração encadeada (máxima consistência) mesmo sem pessoas. */
  maxConsistency: z.boolean().default(false),
});


function aspectFromFormat(fmt: string): "16:9" | "9:16" | "1:1" {
  if (fmt === "facebook") return "1:1";
  return "9:16";
}

type OmniStep = {
  type?: string;
  content?: Array<{
    type?: string;
    uri?: string;
    data?: string;
    mime_type?: string;
    mimeType?: string;
  }>;
};

function extractVideoFromInteraction(json: {
  status?: string;
  steps?: OmniStep[];
  output_video?: { uri?: string; data?: string; mime_type?: string };
}): { uri?: string; data?: string; mime?: string } | null {
  if (json.output_video?.uri || json.output_video?.data) {
    return {
      uri: json.output_video.uri,
      data: json.output_video.data,
      mime: json.output_video.mime_type,
    };
  }
  for (const step of json.steps ?? []) {
    for (const c of step.content ?? []) {
      if (c.type === "video" || c.mime_type?.startsWith("video") || c.mimeType?.startsWith("video")) {
        return { uri: c.uri, data: c.data, mime: c.mime_type ?? c.mimeType };
      }
    }
  }
  return null;
}

type VideoSegment = {
  index: number;
  duration: number;
  interaction_id: string;
  status: "queued" | "pending" | "ready" | "failed";
  storage_path?: string;
  url?: string;
  error?: string;
  retried?: boolean;
};

type VideoMeta = {
  status?: string;
  interaction_id?: string;
  operation?: string;
  segments?: VideoSegment[];
  prompt?: string;
  aspect?: string;
  duration?: number;
  multi_segment?: boolean;
  strategy?: "sequential" | "parallel";
  strategy_reason?: string;
  requirements?: {
    narration: boolean;
    captions: boolean;
    music: boolean;
    hasPeople: boolean;
  };
  qc?: unknown;
  auto_retry_count?: number;
  partial?: boolean;
  error?: string;
};

/** Prompt final de um segmento, com a cláusula de continuidade correcta. */
function segmentPrompt(base: string, index: number, total: number, seconds: number, strategy: "sequential" | "parallel"): string {
  if (total <= 1) return `${base}. Total length about ${seconds}s.`;
  const position =
    index === 0
      ? "Open the scene and establish the subject and environment."
      : index === total - 1
        ? "Close the scene naturally, resolving the motion started in the previous part and landing on a clean hero frame."
        : "Continue the exact motion and action from the previous part with no visual reset.";
  const chain =
    strategy === "sequential"
      ? " This part is generated AFTER the previous one: the first frame of this part must look like a direct continuation of the last frame of the previous part (same framing logic, same subject position, same lighting, same wardrobe and same props)."
      : "";
  return `${base}. This is part ${index + 1} of ${total} of ONE single continuous cinematic scene — identical subject, wardrobe, props, environment, lighting and camera language across all parts. ${position}${chain} This part lasts about ${seconds}s.`;
}


async function startSegmentJob(
  prompt: string,
  aspect: "9:16" | "1:1" | "16:9",
  seconds: number,
  refs: { bytes: Uint8Array; mime: string }[] = [],
): Promise<string> {
  const { startVideoJob } = await import("./studio-video.server");
  return startVideoJob({ prompt, aspect, seconds, ref: refs[0] ?? null });
}


export const startVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => StartVideoSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY não configurada.");

    const [brandRes, productRes] = await Promise.all([
      supabase.from("mm_studio_brand").select("*").eq("user_id", userId).maybeSingle(),
      data.productId
        ? supabase.from("mm_studio_products").select("*").eq("id", data.productId).eq("user_id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const brand = brandRes.data as { brand_name?: string; tone?: string; audience?: string; description?: string } | null;
    const product = productRes.data as { name?: string; category?: string; notes?: string; photos?: string[] } | null;

    // Fotos do produto como referência visual (âncora de consistência).
    const refs: { bytes: Uint8Array; mime: string }[] = [];
    for (const url of (product?.photos ?? []).slice(0, 3)) {
      try {
        refs.push(await fetchAsBytes(url));
      } catch {
        // ignora
      }
    }

    const segments = videoSegments(data.duration);
    const multi = segments.length > 1;
    const totalCost = segments.length * STUDIO_COSTS.video;
    const aspect = aspectFromFormat(data.format);

    // ---- idiomas (pt-PT ≠ pt-BR) ----
    const captionLocale = normalizeLegacyLocale(data.captionsLocale ?? data.captions);
    const narrationVoice = normalizeLegacyVoice(data.narration);
    const narrationLocale = narrationVoice
      ? normalizeLegacyLocale(data.narrationLocale ?? data.narration) ?? captionLocale ?? "pt-PT"
      : null;

    // ---- guião de narração garantido ----
    let narrationScript = data.narrationScript?.trim() || "";
    if (narrationVoice && narrationLocale && !narrationScript) {
      const { generateNarrationScript } = await import("./studio-qc.server");
      narrationScript =
        (await generateNarrationScript({
          localeDirective: localeDirective(narrationLocale),
          duration: data.duration,
          objective: data.objective,
          brand,
          product,
          notes: data.notes,
        })) ?? "";
    }

    // ---- bíblia de consistência ----
    const { generateConsistencyLock } = await import("./studio-qc.server");
    const lock = await generateConsistencyLock({
      people: data.people,
      style: data.style,
      objective: data.objective,
      notes: data.notes,
      brand,
      product,
    });
    const consistency = consistencyBlock(lock);

    // ---- requisitos obrigatórios ----
    const hardRequirements: string[] = [];
    if (narrationVoice && narrationLocale) {
      const voice = VOICE_GENDERS.find((v) => v.id === narrationVoice)?.directive ?? "premium voice-over";
      hardRequirements.push(
        `MANDATORY spoken voice-over: a ${voice} speaking ${localeDirective(narrationLocale)} Audio must be clearly audible, well mixed and perfectly synced with the picture.${
          narrationScript ? ` The voice-over MUST say exactly this script: "${narrationScript}"` : ""
        }`,
      );
    } else {
      hardRequirements.push("No narration — ambient/diegetic sound only, no spoken words.");
    }
    if (captionLocale) {
      hardRequirements.push(
        `MANDATORY burned-in captions in ${localeDirective(captionLocale)} Bold modern social caption style, lower third inside the safe zone, high-contrast white text with subtle shadow, kinetic word-by-word reveal synced to the audio, correctly spelled, never cropped.${
          data.captionText ? ` Caption text: "${data.captionText}"` : ""
        }`,
      );
    } else {
      hardRequirements.push("No captions and no on-screen text of any kind.");
    }
    if (data.music !== "none") {
      hardRequirements.push(
        `MANDATORY ${data.music} background music bed, mixed clearly under the voice-over, dynamic build matched to the edit.`,
      );
    }
    if (refs.length > 0) {
      hardRequirements.push(
        "The attached reference image(s) define the EXACT hero product: identical shape, colours, label, typography, packaging and proportions in every frame. Never invent a different product.",
      );
    }

    const conversionBase = buildVideoPrompt({
      style: data.style as VideoStyle,
      format: data.format as VideoFormat,
      duration: data.duration,
      objective: data.objective ?? "high-conversion product ad",
      people: data.people as PeoplePreset,
      hook: data.hook as ConversionHook,
      brand: brand as BrandDna,
      product: product as ProductCtx,
      hardRequirements,
      consistency,
    });

    const basePrompt = [
      conversionBase,
      product?.notes ? `Product notes: ${product.notes}` : null,
      brand?.description ? `Brand context: ${brand.description}` : null,
      data.notes ? `Extra direction: ${data.notes}` : null,
    ]
      .filter(Boolean)
      .join(". ");

    const { strategy, reason } = pickContinuityStrategy({
      people: data.people as PeoplePreset,
      objective: data.objective,
      hook: data.hook as ConversionHook,
      force: data.maxConsistency,
      segments: segments.length,
    });

    // Débito total antecipado
    const { data: newBal, error: spendErr } = await supabase.rpc("mm_studio_spend_credits", {
      _user_id: userId,
      _amount: totalCost,
      _reason: multi ? `video_generation_${segments.length}x` : "video_generation",
    });
    if (spendErr) {
      if (String(spendErr.message).includes("insufficient_credits")) {
        throw new Error("Créditos insuficientes para gerar vídeo.");
      }
      throw new Error(spendErr.message);
    }

    // Sequencial: arranca só o primeiro; os seguintes são encadeados no poll.
    let segArr: VideoSegment[] = [];
    try {
      if (strategy === "sequential") {
        const firstId = await startSegmentJob(
          segmentPrompt(basePrompt, 0, segments.length, segments[0], strategy),
          aspect,
          segments[0],
          refs,
        );
        segArr = segments.map((secs, i) => ({
          index: i,
          duration: secs,
          interaction_id: i === 0 ? firstId : "",
          status: i === 0 ? "pending" : "queued",
        }));
      } else {
        const ids = await Promise.all(
          segments.map((secs, i) =>
            startSegmentJob(segmentPrompt(basePrompt, i, segments.length, secs, strategy), aspect, secs, refs),
          ),
        );

        segArr = segments.map((secs, i) => ({
          index: i,
          duration: secs,
          interaction_id: ids[i],
          status: "pending",
        }));
      }
    } catch (err) {
      await supabase.rpc("mm_studio_refund_credits", {
        _user_id: userId,
        _amount: totalCost,
        _reason: "video_generation_failed",
      });
      throw err;
    }

    const meta: VideoMeta = {
      status: "pending",
      interaction_id: segArr[0].interaction_id,
      segments: segArr,
      prompt: basePrompt,
      aspect,
      duration: data.duration,
      multi_segment: multi,
      strategy,
      strategy_reason: reason,
      requirements: {
        narration: Boolean(narrationVoice && narrationLocale),
        captions: Boolean(captionLocale),
        music: data.music !== "none",
        hasPeople: data.people !== "none",
      },
      auto_retry_count: 0,
    };

    const { data: asset, error: aErr } = await supabase
      .from("mm_studio_assets")
      .insert({
        user_id: userId,
        kind: "video",
        url: `pending://${segArr[0].interaction_id}`,
        format: data.format,
        style: data.style,
        product_id: data.productId ?? null,
        credits_used: totalCost,
        metadata: {
          ...meta,
          model: OMNI_MODEL,
          consistency_lock: lock ?? null,
          consistency_block: consistency,
          narration_locale: narrationLocale,
          narration_voice: narrationVoice,
          narration_script: narrationScript || null,
          captions_locale: captionLocale,
        } as never,

      })
      .select("id")
      .single();
    if (aErr) throw new Error(aErr.message);

    return {
      assetId: asset.id,
      operation: segArr[0].interaction_id,
      balance: newBal as number,
      strategy,
      strategyReason: reason,
    };
  });


// Downloads the video bytes for a completed Omni interaction and uploads to storage.
type SupabaseCtx = { storage: { from: (b: string) => { upload: (p: string, buf: Uint8Array, o: { contentType: string; upsert: boolean }) => Promise<{ error: { message: string } | null }>; createSignedUrl: (p: string, s: number) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }> } } };

async function materializeSegment(
  key: string,
  supabase: SupabaseCtx,
  userId: string,
  op: {
    status?: string;
    error?: { message?: string };
    steps?: OmniStep[];
    output_video?: { uri?: string; data?: string; mime_type?: string };
  },
): Promise<{ path: string; url: string }> {
  const video = extractVideoFromInteraction(op);
  if (!video || (!video.uri && !video.data)) throw new Error("Omni devolveu resposta sem vídeo.");
  let buf: Uint8Array;
  const mime = video.mime ?? "video/mp4";
  if (video.uri) {
    let dl = await fetch(video.uri, { headers: { "x-goog-api-key": key } });
    if (!dl.ok && video.uri.includes("/files/")) {
      const name = video.uri.split("/files/")[1]?.split("?")[0];
      if (name) {
        for (let i = 0; i < 20; i++) {
          const info = await fetch(`https://generativelanguage.googleapis.com/v1beta/files/${name}`, {
            headers: { "x-goog-api-key": key },
          });
          const j = (await info.json().catch(() => ({}))) as { state?: string; uri?: string };
          if (j.state === "ACTIVE") {
            dl = await fetch(j.uri ?? video.uri, { headers: { "x-goog-api-key": key } });
            break;
          }
          if (j.state === "FAILED") throw new Error("Ficheiro de vídeo falhou.");
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }
    if (!dl.ok) throw new Error(`Download Omni falhou (${dl.status}).`);
    buf = new Uint8Array(await dl.arrayBuffer());
  } else {
    const bin = atob(video.data!);
    buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  }
  const ext = mime.includes("webm") ? "webm" : "mp4";
  const path = `${userId}/videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const up = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: mime, upsert: false });
  if (up.error) throw new Error(up.error.message);
  const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (signed.error || !signed.data) throw new Error(signed.error?.message ?? "URL falhou");
  return { path, url: signed.data.signedUrl };
}

async function pollOmni(key: string, interactionId: string) {
  const opRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/interactions/${interactionId}`, {
    headers: { "x-goog-api-key": key },
  });
  if (!opRes.ok) {
    const t = await opRes.text().catch(() => "");
    throw new Error(`Poll Omni ${opRes.status}: ${t.slice(0, 200)}`);
  }
  return (await opRes.json()) as {
    status?: string;
    error?: { message?: string };
    steps?: OmniStep[];
    output_video?: { uri?: string; data?: string; mime_type?: string };
  };
}

export const pollVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ assetId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY não configurada.");

    const { data: asset, error } = await supabase
      .from("mm_studio_assets")
      .select("id, url, credits_used, metadata")
      .eq("id", data.assetId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!asset) throw new Error("Asset não encontrado.");

    const meta = (asset.metadata ?? {}) as VideoMeta & {
      consistency_lock?: ConsistencyLock | null;
    };
    const strategy: "sequential" | "parallel" = meta.strategy === "sequential" ? "sequential" : "parallel";
    const basePrompt = meta.prompt ?? "";
    const aspect = (meta.aspect as "9:16" | "1:1" | "16:9") ?? "9:16";

    const saveMeta = async (patch: Record<string, unknown>) => {
      await supabase
        .from("mm_studio_assets")
        .update({ metadata: { ...meta, ...patch } as never })
        .eq("id", asset.id);
    };

    if (meta.status === "ready") {
      return {
        status: "ready" as const,
        url: asset.url,
        urls: (meta.segments ?? []).map((s) => s.url).filter(Boolean) as string[],
        id: asset.id,
        qc: meta.qc ?? null,
      };
    }
    if (meta.status === "failed") {
      return { status: "failed" as const, id: asset.id, error: meta.error ?? "Geração falhou." };
    }

    // Legacy: interação única sem array de segmentos
    let segs: VideoSegment[] = meta.segments ?? [];
    if (segs.length === 0) {
      const legacyId = meta.interaction_id ?? meta.operation;
      if (!legacyId) throw new Error("Interação em falta.");
      segs = [{ index: 0, duration: meta.duration ?? 8, interaction_id: legacyId, status: "pending" }];
    }

    // Poll de cada segmento activo
    let anyFailed = false;
    let failureMsg = "";
    for (const seg of segs) {
      if (seg.status !== "pending") continue;
      const op = await pollOmni(key, seg.interaction_id);
      const st = op.status ?? "pending";
      if (st === "failed" || st === "cancelled" || op.error) {
        seg.status = "failed";
        seg.error = op.error?.message ?? "Falhou.";
        anyFailed = true;
        failureMsg = seg.error;
        continue;
      }
      if (st !== "completed" && st !== "succeeded") continue;
      try {
        const mat = await materializeSegment(key, supabase as unknown as SupabaseCtx, userId, op);
        seg.status = "ready";
        seg.storage_path = mat.path;
        seg.url = mat.url;
      } catch (err) {
        seg.status = "failed";
        seg.error = err instanceof Error ? err.message : String(err);
        anyFailed = true;
        failureMsg = seg.error;
      }
    }

    // Cadeia sequencial: arrancar o próximo segmento quando o anterior fica pronto.
    if (strategy === "sequential" && !anyFailed) {
      const next = segs.find((s) => s.status === "queued");
      const prevDone = next ? segs[next.index - 1]?.status === "ready" : false;
      if (next && prevDone) {
        try {
          next.interaction_id = await startSegmentJob(
            segmentPrompt(basePrompt, next.index, segs.length, next.duration, "sequential"),
            aspect,
            next.duration,
          );

          next.status = "pending";
        } catch (err) {
          next.status = "failed";
          next.error = err instanceof Error ? err.message : String(err);
          anyFailed = true;
          failureMsg = next.error;
        }
      }
    }

    if (anyFailed) {
      const failedCount = segs.filter((s) => s.status === "failed").length;
      const queued = segs.filter((s) => s.status === "queued");
      // Cadeia partida: os segmentos por arrancar deixam de fazer sentido.
      for (const q of queued) {
        q.status = "failed";
        q.error = "Cadeia interrompida.";
      }
      const refund = (failedCount + queued.length) * STUDIO_COSTS.video;
      if (refund > 0) {
        await supabase.rpc("mm_studio_refund_credits", {
          _user_id: userId,
          _amount: refund,
          _reason: "video_generation_failed_partial",
        });
      }
      const readySegs = segs.filter((s) => s.status === "ready");
      const allDone = segs.every((s) => s.status !== "pending" && s.status !== "queued");
      if (allDone && readySegs.length === 0) {
        await saveMeta({ segments: segs, status: "failed", error: failureMsg });
        return { status: "failed" as const, id: asset.id, error: failureMsg };
      }
      if (allDone) {
        const first = readySegs[0];
        await supabase
          .from("mm_studio_assets")
          .update({
            url: first.url ?? asset.url,
            thumb_url: first.url ?? null,
            metadata: { ...meta, segments: segs, status: "ready", partial: true } as never,
          })
          .eq("id", asset.id);
        return {
          status: "ready" as const,
          url: first.url ?? asset.url,
          urls: readySegs.map((s) => s.url!).filter(Boolean),
          id: asset.id,
          partial: true,
          qc: null,
        };
      }
      await saveMeta({ segments: segs });
      return { status: "pending" as const, id: asset.id };
    }

    const allReady = segs.every((s) => s.status === "ready");
    if (!allReady) {
      await saveMeta({ segments: segs });
      return { status: "pending" as const, id: asset.id };
    }

    // ---------- Controlo de qualidade antes da entrega ----------
    let qcReport = meta.qc as { verdict?: string; checks?: unknown[]; badSegments?: number[] } | null | undefined;
    if (!qcReport) {
      const { runVideoQc, absorbedBudget } = await import("./studio-qc.server");
      const req = meta.requirements ?? { narration: false, captions: false, music: false, hasPeople: false };
      const report = await runVideoQc(
        segs.map((s) => s.url!).filter(Boolean),
        { ...req, expectedSegments: segs.length },
      );
      qcReport = report;

      const retries = meta.auto_retry_count ?? 0;
      const canRetry = report.verdict === "failed" && report.badSegments.length > 0 && retries < 1;

      if (canRetry) {
        const budget = await absorbedBudget(supabase as never);
        const cost = report.badSegments.length * STUDIO_COSTS.video;
        if (budget.allowed) {
          // Regenera automaticamente, sem custo para o membro.
          let restarted = 0;
          for (const idx of report.badSegments) {
            const seg = segs[idx];
            if (!seg) continue;
            try {
              seg.interaction_id = await startSegmentJob(
                `${segmentPrompt(basePrompt, idx, segs.length, seg.duration, strategy)} CRITICAL FIX PASS: the previous render was rejected by quality control for: ${report.checks
                  .filter((c) => !c.ok)
                  .map((c) => c.id)
                  .join(", ")}. Fix these issues while keeping everything else identical.`,
                aspect,
                seg.duration,
              );

              seg.status = "pending";
              seg.retried = true;
              seg.url = undefined;
              seg.storage_path = undefined;
              restarted++;
            } catch {
              // mantém o segmento existente se a regeneração não arrancar
            }
          }
          if (restarted > 0) {
            try {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              await supabaseAdmin.from("mm_studio_qc_log").insert({
                user_id: userId,
                asset_id: asset.id,
                verdict: report.verdict,
                reasons: report.checks.filter((c) => !c.ok).map((c) => c.id) as never,
                confidence: report.checks.filter((c) => !c.ok)[0]?.confidence ?? null,
                regenerated_segments: restarted,
                credits_absorbed: cost,
                report: report as never,
              } as never);

            } catch {
              // log é best-effort
            }
            await saveMeta({ segments: segs, auto_retry_count: retries + 1, qc: null, last_qc: report as never });
            return { status: "pending" as const, id: asset.id, autoFixing: true };
          }
        }
      }

      // Sem regeneração — regista o resultado do QC.
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("mm_studio_qc_log").insert({
          user_id: userId,
          asset_id: asset.id,
          verdict: report.verdict,
          reasons: report.checks.filter((c) => !c.ok).map((c) => c.id) as never,
          confidence: report.checks.filter((c) => !c.ok)[0]?.confidence ?? null,
          regenerated_segments: 0,
          credits_absorbed: 0,
          report: report as never,
        } as never);

      } catch {
        // best-effort
      }
    }

    const first = segs[0];
    await supabase
      .from("mm_studio_assets")
      .update({
        url: first.url ?? asset.url,
        thumb_url: first.url ?? null,
        metadata: { ...meta, segments: segs, status: "ready", qc: qcReport as never } as never,
      })
      .eq("id", asset.id);

    return {
      status: "ready" as const,
      url: first.url ?? asset.url,
      urls: segs.map((s) => s.url!).filter(Boolean),
      id: asset.id,
      qc: qcReport ?? null,
    };
  });



// ============ LOGO GENERATION ============
const GenerateLogosSchema = z.object({
  brandName: z.string().min(1).max(60),
  tagline: z.string().max(80).optional(),
  industry: z.string().max(120).optional(),
  style: z.enum([
    "monograma", "wordmark", "emblema", "minimalista", "luxo",
    "geometrico", "organico", "tech", "vintage", "mascote",
  ]),
  layout: z.enum(["icone", "horizontal", "vertical"]).default("horizontal"),
  background: z.enum(["branco", "preto", "transparente"]).default("branco"),
  palette: z.enum(["marca", "mono_preto", "mono_branco", "ouro", "livre"]).default("marca"),
  notes: z.string().max(600).optional(),
});

export const generateLogos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => GenerateLogosSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { buildLogoPrompt, LOGO_VARIANTS, LOGO_COST_PER_VARIANT } = await import("./studio-logo");
    const cost = LOGO_VARIANTS * LOGO_COST_PER_VARIANT;

    const { data: brandRow } = await supabase
      .from("mm_studio_brand")
      .select("colors")
      .eq("user_id", userId)
      .maybeSingle();
    const rawColors = (brandRow?.colors as unknown) ?? [];
    const colors = Array.isArray(rawColors) ? rawColors.map(String).slice(0, 6) : [];

    const { data: newBal, error: spendErr } = await supabase.rpc("mm_studio_spend_credits", {
      _user_id: userId,
      _amount: cost,
      _reason: "logo_generation",
    });
    if (spendErr) {
      if (String(spendErr.message).includes("insufficient_credits")) {
        throw new Error("Créditos insuficientes. Compra mais créditos para continuar.");
      }
      throw new Error(spendErr.message);
    }

    const basePrompt = buildLogoPrompt({
      brandName: data.brandName,
      tagline: data.tagline,
      industry: data.industry,
      style: data.style,
      layout: data.layout,
      background: data.background,
      palette: data.palette,
      colors,
      notes: data.notes,
    });

    const directions = [
      "Variation A: the most iconic, reduced and confident interpretation.",
      "Variation B: a distinctly different construction — rethink the symbol geometry and proportions.",
      "Variation C: a bolder, more expressive interpretation while staying premium and timeless.",
    ];

    const generateOne = async (i: number) => {
      const b64 = await callImageModel(`${basePrompt} ${directions[i] ?? ""}`.trim(), "1024x1024");
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const path = `${userId}/logos/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.png`;
      const up = await supabase.storage.from(BUCKET).upload(path, bytes, {
        contentType: "image/png",
        upsert: false,
      });
      if (up.error) throw new Error(up.error.message);
      const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signed.error || !signed.data) throw new Error(signed.error?.message ?? "URL falhou");
      const url = signed.data.signedUrl;
      const { data: asset, error: aErr } = await supabase
        .from("mm_studio_assets")
        .insert({
          user_id: userId,
          kind: "image",
          url,
          thumb_url: url,
          format: "logo",
          style: data.style,
          credits_used: LOGO_COST_PER_VARIANT,
          metadata: {
            prompt: basePrompt,
            kind: "logo",
            brand_name: data.brandName,
            layout: data.layout,
            background: data.background,
            palette: data.palette,
            size: "1024x1024",
            model: OPENAI_IMAGE_MODEL,
            storage_path: path,
          },
        })
        .select("id, url")
        .single();
      if (aErr) throw new Error(aErr.message);
      return { id: asset.id, url: asset.url };
    };

    const results = await Promise.allSettled(
      Array.from({ length: LOGO_VARIANTS }, (_, i) => generateOne(i)),
    );
    const generated: { id: string; url: string }[] = [];
    let firstError: unknown = null;
    for (const r of results) {
      if (r.status === "fulfilled") generated.push(r.value);
      else if (!firstError) firstError = r.reason;
    }

    const refund = (LOGO_VARIANTS - generated.length) * LOGO_COST_PER_VARIANT;
    let finalBalance = newBal as number;
    if (refund > 0) {
      const { data: refunded } = await supabase.rpc("mm_studio_refund_credits", {
        _user_id: userId,
        _amount: refund,
        _reason: "logo_generation_refund",
      });
      if (typeof refunded === "number") finalBalance = refunded;
    }

    if (generated.length === 0) {
      throw firstError instanceof Error ? firstError : new Error("Falha ao gerar logotipos.");
    }

    return { assets: generated, balance: finalBalance, cost: cost - refund };
  });

/** Gera mockups / banners a partir de um logotipo já criado. */
export const generateLogoApplications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        logoUrl: z.string().url().max(2000),
        applications: z.array(z.string().min(1)).min(1).max(6),
        brandName: z.string().min(1).max(60),
        notes: z.string().max(600).optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { buildLogoApplicationPrompt, LOGO_APPLICATIONS, LOGO_APPLICATION_COST } = await import("./studio-logo");

    const picked = data.applications
      .map((id) => LOGO_APPLICATIONS.find((a) => a.id === id))
      .filter((a): a is (typeof LOGO_APPLICATIONS)[number] => Boolean(a));
    if (picked.length === 0) throw new Error("Escolhe pelo menos uma aplicação.");

    const cost = picked.length * LOGO_APPLICATION_COST;

    const { data: brandRow } = await supabase
      .from("mm_studio_brand")
      .select("colors")
      .eq("user_id", userId)
      .maybeSingle();
    const rawColors = (brandRow?.colors as unknown) ?? [];
    const colors = Array.isArray(rawColors) ? rawColors.map(String).slice(0, 6) : [];

    // O logo tem de estar no nosso armazenamento (protege contra SSRF).
    const logoRef = await fetchAsBytes(data.logoUrl);

    const { data: newBal, error: spendErr } = await supabase.rpc("mm_studio_spend_credits", {
      _user_id: userId,
      _amount: cost,
      _reason: "logo_applications",
    });
    if (spendErr) {
      if (String(spendErr.message).includes("insufficient_credits")) {
        throw new Error("Créditos insuficientes. Compra mais créditos para continuar.");
      }
      throw new Error(spendErr.message);
    }

    const generateOne = async (app: (typeof LOGO_APPLICATIONS)[number]) => {
      const prompt = buildLogoApplicationPrompt({
        application: app.id,
        brandName: data.brandName,
        colors,
        notes: data.notes,
      });
      const b64 = await callImageModel(prompt, app.size, [logoRef]);
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const path = `${userId}/logos/apps/${Date.now()}-${app.id}-${Math.random().toString(36).slice(2, 8)}.png`;
      const up = await supabase.storage.from(BUCKET).upload(path, bytes, {
        contentType: "image/png",
        upsert: false,
      });
      if (up.error) throw new Error(up.error.message);
      const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signed.error || !signed.data) throw new Error(signed.error?.message ?? "URL falhou");
      const url = signed.data.signedUrl;
      const { data: asset, error: aErr } = await supabase
        .from("mm_studio_assets")
        .insert({
          user_id: userId,
          kind: "image",
          url,
          thumb_url: url,
          format: `logo_${app.id}`,
          style: "branding",
          credits_used: LOGO_APPLICATION_COST,
          metadata: {
            prompt,
            kind: "logo_application",
            application: app.id,
            brand_name: data.brandName,
            size: app.size,
            storage_path: path,
          },
        })
        .select("id, url")
        .single();
      if (aErr) throw new Error(aErr.message);
      return { id: asset.id, url: asset.url, application: app.id, label: app.label };
    };

    const results = await Promise.allSettled(picked.map(generateOne));
    const generated: { id: string; url: string; application: string; label: string }[] = [];
    let firstError: unknown = null;
    for (const r of results) {
      if (r.status === "fulfilled") generated.push(r.value);
      else if (!firstError) firstError = r.reason;
    }

    const refund = (picked.length - generated.length) * LOGO_APPLICATION_COST;
    let finalBalance = newBal as number;
    if (refund > 0) {
      const { data: refunded } = await supabase.rpc("mm_studio_refund_credits", {
        _user_id: userId,
        _amount: refund,
        _reason: "logo_applications_refund",
      });
      if (typeof refunded === "number") finalBalance = refunded;
    }

    if (generated.length === 0) {
      throw firstError instanceof Error ? firstError : new Error("Falha ao gerar aplicações.");
    }

    return { assets: generated, balance: finalBalance, cost: cost - refund };
  });

/** Guarda um logotipo gerado como logo oficial do Brand DNA. */

export const setBrandLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ url: z.string().url().max(2000) }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("mm_studio_brand")
      .upsert({ user_id: userId, logo_url: data.url }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ============ ASSETS ============
export const listAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ kind: z.enum(["image", "video", "all"]).default("all") }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let query = supabase.from("mm_studio_assets").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
    if (data.kind !== "all") query = query.eq("kind", data.kind);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listLogoHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("mm_studio_assets")
      .select("id, url, format, created_at, metadata")
      .eq("user_id", userId)
      .like("format", "logo%")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const meta = (r.metadata ?? {}) as { kind?: string; application?: string; brand_name?: string };
      return {
        id: r.id as string,
        url: r.url as string,
        format: (r.format ?? "logo") as string,
        createdAt: r.created_at as string,
        isApplication: meta.kind === "logo_application",
        application: meta.application ?? null,
        brandName: meta.brand_name ?? null,
      };
    });
  });



export const deleteAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: asset } = await supabase.from("mm_studio_assets").select("metadata").eq("id", data.id).eq("user_id", userId).maybeSingle();
    const path = (asset?.metadata as { storage_path?: string } | null)?.storage_path;
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    const { error } = await supabase.from("mm_studio_assets").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ THUMBNAIL BUILDER ============
const GenerateThumbnailsSchema = z.object({
  youtubeUrl: z.string().max(400).optional(),
  headline: z.string().max(60).optional(),
  topic: z.string().max(300).optional(),
  style: z.enum(["mrbeast", "premium", "documentario", "podcast", "tutorial", "minimal"]).default("mrbeast"),
  notes: z.string().max(400).optional(),
});

export const generateThumbnails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => GenerateThumbnailsSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const {
      buildThumbnailPrompt,
      parseYouTubeId,
      THUMB_VARIANTS,
      THUMB_COST_PER_VARIANT,
      THUMB_SIZE,
      THUMB_VARIANT_DIRECTIONS,
    } = await import("./thumbnail-config");

    let videoTitle = "";
    let channel = "";
    const videoId = data.youtubeUrl ? parseYouTubeId(data.youtubeUrl) : null;
    if (data.youtubeUrl && !videoId) {
      throw new Error("Link do YouTube inválido. Cola o URL completo do vídeo.");
    }
    if (videoId) {
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        );
        if (res.ok) {
          const j = (await res.json()) as { title?: string; author_name?: string };
          videoTitle = String(j.title ?? "").slice(0, 200);
          channel = String(j.author_name ?? "").slice(0, 80);
        }
      } catch {
        /* metadados opcionais */
      }
    }

    // Frame real do vídeo — é isto que dá thumbnails com a pessoa certa.
    let frame: { bytes: Uint8Array; mime: string } | null = null;
    if (videoId) {
      for (const name of ["maxresdefault.jpg", "sddefault.jpg", "hqdefault.jpg"]) {
        try {
          const r = await fetch(`https://i.ytimg.com/vi/${videoId}/${name}`);
          if (!r.ok) continue;
          const buf = new Uint8Array(await r.arrayBuffer());
          // O placeholder cinzento do YouTube é minúsculo — ignora-o.
          if (buf.byteLength < 8000) continue;
          frame = { bytes: buf, mime: r.headers.get("content-type")?.split(";")[0] || "image/jpeg" };
          break;
        } catch {
          /* tenta a próxima resolução */
        }
      }
    }

    const topic = (data.topic?.trim() || videoTitle || "").trim();
    if (!topic && !data.headline?.trim()) {
      throw new Error("Cola o link do vídeo ou descreve o tema para gerarmos a thumbnail.");
    }

    // Headline: usa a do utilizador ou deixa a IA escrever a melhor.
    let headline = data.headline?.trim() ?? "";
    if (!headline) {
      const key = process.env.LOVABLE_API_KEY;
      if (!key) throw new Error("IA indisponível para escrever o texto da thumbnail.");
      const { generateText } = await import("ai");
      const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
      const gateway = createLovableAiGatewayProvider(key);
      const { text } = await generateText({
        model: gateway("google/gemini-3.6-flash"),
        system: [
          "És copywriter de thumbnails de YouTube em português de Portugal.",
          "Devolves APENAS o texto da thumbnail: 2 a 4 palavras, maiúsculas, alto impacto, sem emojis, sem aspas, sem pontuação final.",
          "Nunca prometas resultados garantidos.",
        ].join(" "),
        prompt: `Título do vídeo: ${topic}${channel ? `\nCanal: ${channel}` : ""}`,
      });
      headline = text
        .replace(/["'`]/g, "")
        .split("\n")[0]
        .trim()
        .slice(0, 40)
        .toUpperCase();
      if (!headline) headline = topic.slice(0, 32).toUpperCase();
    }

    const cost = THUMB_VARIANTS * THUMB_COST_PER_VARIANT;
    const { data: newBal, error: spendErr } = await supabase.rpc("mm_studio_spend_credits", {
      _user_id: userId,
      _amount: cost,
      _reason: "thumbnail_generation",
    });
    if (spendErr) {
      if (String(spendErr.message).includes("insufficient_credits")) {
        throw new Error("Créditos insuficientes. Compra mais créditos para continuar.");
      }
      throw new Error(spendErr.message);
    }

    const generateOne = async (i: number) => {
      const prompt = buildThumbnailPrompt(
        { style: data.style, headline, topic: topic || headline, channel, notes: data.notes },
        THUMB_VARIANT_DIRECTIONS[i] ?? "",
        Boolean(frame),
      );
      // Com frame do vídeo, o motor de edição do Gemini preserva a identidade
      // muito melhor; sem frame, mantemos o gerador principal.
      let b64: string;
      if (frame) {
        try {
          b64 = await callGeminiImageModel(prompt, [frame], { safetySuffix: false });
        } catch {
          b64 = await callImageModel(prompt, THUMB_SIZE, [frame]);
        }
      } else {
        b64 = await callImageModel(prompt, THUMB_SIZE);
      }

      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const path = `${userId}/thumbnails/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.png`;
      const up = await supabase.storage.from(BUCKET).upload(path, bytes, {
        contentType: "image/png",
        upsert: false,
      });
      if (up.error) throw new Error(up.error.message);
      const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signed.error || !signed.data) throw new Error(signed.error?.message ?? "URL falhou");
      const url = signed.data.signedUrl;
      const { data: asset, error: aErr } = await supabase
        .from("mm_studio_assets")
        .insert({
          user_id: userId,
          kind: "image",
          url,
          thumb_url: url,
          format: "thumbnail",
          style: data.style,
          credits_used: THUMB_COST_PER_VARIANT,
          metadata: {
            prompt,
            kind: "thumbnail",
            headline,
            topic,
            channel,
            youtube_id: videoId,
            size: THUMB_SIZE,
            model: OPENAI_IMAGE_MODEL,
            storage_path: path,
          },
        })
        .select("id, url")
        .single();
      if (aErr) throw new Error(aErr.message);
      return { id: asset.id as string, url: asset.url as string };
    };

    const results = await Promise.allSettled(
      Array.from({ length: THUMB_VARIANTS }, (_, i) => generateOne(i)),
    );
    const generated: { id: string; url: string }[] = [];
    let firstError: unknown = null;
    for (const r of results) {
      if (r.status === "fulfilled") generated.push(r.value);
      else if (!firstError) firstError = r.reason;
    }

    const refund = (THUMB_VARIANTS - generated.length) * THUMB_COST_PER_VARIANT;
    let finalBalance = newBal as number;
    if (refund > 0) {
      const { data: refunded } = await supabase.rpc("mm_studio_refund_credits", {
        _user_id: userId,
        _amount: refund,
        _reason: "thumbnail_generation_refund",
      });
      if (typeof refunded === "number") finalBalance = refunded;
    }

    if (generated.length === 0) {
      throw firstError instanceof Error ? firstError : new Error("Falha ao gerar thumbnails.");
    }

    return { assets: generated, headline, balance: finalBalance, cost: cost - refund };
  });
