import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STUDIO_COSTS, IMAGE_FORMATS, videoSegments, type ImageFormat, type ImageStyle, type PeoplePreset, type SceneMode, type ConversionHook, type VideoStyle, type VideoFormat } from "./studio-config";
import { buildImagePrompt, buildVideoPrompt, type BrandDna, type ProductCtx } from "./studio-prompt";

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

    // Auto-provision credits row if missing
    let credits = creditsRes.data;
    if (!credits) {
      const { data } = await supabase
        .from("mm_studio_credits")
        .insert({ user_id: userId, balance: 400, lifetime_granted: 400 })
        .select("balance, lifetime_granted, lifetime_spent")
        .maybeSingle();
      credits = data ?? { balance: 400, lifetime_granted: 400, lifetime_spent: 0 };
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

async function fetchAsBytes(url: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Não consegui carregar imagem de referência (${r.status}).`);
  const mime = r.headers.get("content-type") ?? "image/png";
  return { bytes: new Uint8Array(await r.arrayBuffer()), mime };
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function callImageModel(
  prompt: string,
  size: string,
  refs: { bytes: Uint8Array; mime: string }[] = [],
): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY não configurada. Adiciona a chave nos secrets do backend.");

  let res: Response;
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
    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
  } else {
    res = await fetch("https://api.openai.com/v1/images/generations", {
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

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401) throw new Error("Chave OpenAI inválida. Verifica OPENAI_API_KEY.");
    if (res.status === 402 || res.status === 429) {
      throw new Error("OpenAI recusou o pedido (créditos ou rate limit). Tenta novamente daqui a pouco.");
    }
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 240)}`);
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("Resposta inesperada da OpenAI.");
  return b64;
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

    const prompt = buildImagePrompt({
      style: data.style as ImageStyle,
      format: data.format as ImageFormat,
      scene: data.scene as SceneMode | undefined,
      people: data.people as PeoplePreset,
      hook: data.hook as ConversionHook,
      brand,
      product,
      notes: data.notes,
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
  captions: z.enum(["none", "pt", "en", "es"]).default("none"),
  captionText: z.string().max(300).optional(),
  narration: z.enum(["none", "male_pt", "female_pt", "male_en", "female_en", "neutral"]).default("none"),
  narrationScript: z.string().max(800).optional(),
  music: z.enum(["none", "cinematic", "upbeat", "elegant", "epic", "chill", "corporate"]).default("none"),
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
  status: "pending" | "ready" | "failed";
  storage_path?: string;
  url?: string;
  error?: string;
};

async function startOmniInteraction(
  key: string,
  prompt: string,
  aspect: "9:16" | "1:1" | "16:9",
  refs: { bytes: Uint8Array; mime: string }[] = [],
): Promise<string> {
  const input = refs.length > 0
    ? [
        ...refs.slice(0, 3).map((r) => ({
          type: "image",
          data: bytesToB64(r.bytes),
          mime_type: r.mime,
        })),
        { type: "text", text: prompt },
      ]
    : prompt;

  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      model: OMNI_MODEL,
      input,
      response_format: { type: "video", aspect_ratio: aspect, delivery: "uri" },
      background: true,
      store: true,
      stream: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini Omni ${res.status}: ${text.slice(0, 240)}`);
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("Omni não devolveu id de interação.");
  return json.id;
}

export const startVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => StartVideoSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY não configurada.");

    // Load brand + product for a rich prompt
    const [brandRes, productRes] = await Promise.all([
      supabase.from("mm_studio_brand").select("*").eq("user_id", userId).maybeSingle(),
      data.productId
        ? supabase.from("mm_studio_products").select("*").eq("id", data.productId).eq("user_id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const brand = brandRes.data as { brand_name?: string; tone?: string; description?: string } | null;
    const product = productRes.data as { name?: string; category?: string; notes?: string; photos?: string[] } | null;

    // Carregar fotos do produto para injectar como referência visual no Omni.
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

    const refClause = refs.length > 0
      ? "Use the attached reference image(s) as the EXACT product hero — keep the same shape, colours, label, packaging and proportions in every frame. Do not invent a different product."
      : null;

    const captionLangMap: Record<string, string> = {
      pt: "Portuguese", en: "English", es: "Spanish",
    };
    const captionClause = data.captions !== "none"
      ? `Burn in bold, modern social-media captions in ${captionLangMap[data.captions]}, centered lower-third, high-contrast white text with subtle drop shadow, kinetic word-by-word reveal synced to voiceover${data.captionText ? `. Caption text: "${data.captionText}"` : ""}.`
      : "no on-screen text, no captions, no logos.";

    const narrationVoiceMap: Record<string, string> = {
      male_pt: "confident male voice-over in Portuguese",
      female_pt: "warm female voice-over in Portuguese",
      male_en: "confident male voice-over in English",
      female_en: "warm female voice-over in English",
      neutral: "neutral premium voice-over",
    };
    const narrationClause = data.narration !== "none"
      ? `Include a ${narrationVoiceMap[data.narration]}, cinematic advertising tone, perfectly lip-agnostic${data.narrationScript ? `. Voice-over script: "${data.narrationScript}"` : ", concise persuasive script matching the objective"}.`
      : "no narration, ambient sound only.";

    const musicClause = data.music !== "none"
      ? `Layered ${data.music} background music track, well-mixed under the narration, dynamic build matching the edit.`
      : "";

    const conversionBase = buildVideoPrompt({
      style: data.style as VideoStyle,
      format: data.format as VideoFormat,
      duration: data.duration,
      objective: data.objective ?? "high-conversion product ad",
      people: data.people as PeoplePreset,
      hook: data.hook as ConversionHook,
      brand: brand as BrandDna,
      product: product as ProductCtx,
    });

    const basePrompt = [
      conversionBase,
      product?.notes ? `Product notes: ${product.notes}` : null,
      brand?.description ? `Brand context: ${brand.description}` : null,
      data.notes ? `Extra direction: ${data.notes}` : null,
      refClause,
      narrationClause,
      captionClause,
      musicClause || null,
      "Smooth motivated camera motion, dramatic lighting, premium color grading, 4k.",
    ].filter(Boolean).join(". ");

    // Spend all credits upfront
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

    // Start all segments in parallel with continuity prompt engineering
    let startedIds: string[] = [];
    try {
      startedIds = await Promise.all(
        segments.map((secs, i) => {
          const continuity = multi
            ? ` This is part ${i + 1} of ${segments.length} in one continuous cinematic scene — keep the exact same subject, wardrobe, environment, lighting, color palette and camera style as the other parts. ${
                i === 0
                  ? "Open the scene."
                  : i === segments.length - 1
                    ? "Close the scene naturally, resolving the motion started before."
                    : "Continue the motion from the previous part seamlessly."
              }`
            : "";
          const prompt = `${basePrompt}. About ${secs}s.${continuity}`;
          return startOmniInteraction(key, prompt, aspect, refs);
        }),
      );
    } catch (err) {
      await supabase.rpc("mm_studio_refund_credits", {
        _user_id: userId,
        _amount: totalCost,
        _reason: "video_generation_failed",
      });
      throw err;
    }

    const segArr: VideoSegment[] = segments.map((secs, i) => ({
      index: i,
      duration: secs,
      interaction_id: startedIds[i],
      status: "pending",
    }));

    const { data: asset, error: aErr } = await supabase
      .from("mm_studio_assets")
      .insert({
        user_id: userId,
        kind: "video",
        url: `pending://${startedIds[0]}`,
        format: data.format,
        style: data.style,
        product_id: data.productId ?? null,
        credits_used: totalCost,
        metadata: {
          status: "pending",
          interaction_id: startedIds[0], // legacy compat
          segments: segArr,
          prompt: basePrompt,
          model: OMNI_MODEL,
          aspect,
          duration: data.duration,
          multi_segment: multi,
        },
      })
      .select("id")
      .single();
    if (aErr) throw new Error(aErr.message);

    return { assetId: asset.id, operation: startedIds[0], balance: newBal as number };
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

    const meta = (asset.metadata ?? {}) as {
      status?: string;
      interaction_id?: string;
      operation?: string;
      segments?: VideoSegment[];
      prompt?: string;
      aspect?: string;
      duration?: number;
      multi_segment?: boolean;
    };

    if (meta.status === "ready") {
      return {
        status: "ready" as const,
        url: asset.url,
        urls: (meta.segments ?? []).map((s) => s.url).filter(Boolean) as string[],
        id: asset.id,
      };
    }
    if (meta.status === "failed") {
      return { status: "failed" as const, id: asset.id, error: "Geração falhou." };
    }

    // Legacy: single interaction without segments array
    let segs: VideoSegment[] = meta.segments ?? [];
    if (segs.length === 0) {
      const legacyId = meta.interaction_id ?? meta.operation;
      if (!legacyId) throw new Error("Interação em falta.");
      segs = [{ index: 0, duration: meta.duration ?? 8, interaction_id: legacyId, status: "pending" }];
    }

    // Poll every still-pending segment
    let anyFailed = false;
    let failureMsg = "";
    for (const seg of segs) {
      if (seg.status === "ready" || seg.status === "failed") continue;
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

    if (anyFailed) {
      // Refund unpaid segments proportionally
      const failedCount = segs.filter((s) => s.status === "failed").length;
      const refund = failedCount * STUDIO_COSTS.video;
      if (refund > 0) {
        await supabase.rpc("mm_studio_refund_credits", {
          _user_id: userId,
          _amount: refund,
          _reason: "video_generation_failed_partial",
        });
      }
      const readySegs = segs.filter((s) => s.status === "ready");
      const allDone = segs.every((s) => s.status !== "pending");
      if (allDone && readySegs.length === 0) {
        await supabase
          .from("mm_studio_assets")
          .update({ metadata: { ...meta, segments: segs, status: "failed", error: failureMsg } })
          .eq("id", asset.id);
        return { status: "failed" as const, id: asset.id, error: failureMsg };
      }
      if (allDone) {
        // Some segments ready — publish partial
        const first = readySegs[0];
        await supabase
          .from("mm_studio_assets")
          .update({
            url: first.url ?? asset.url,
            thumb_url: first.url ?? null,
            metadata: { ...meta, segments: segs, status: "ready", partial: true },
          })
          .eq("id", asset.id);
        return {
          status: "ready" as const,
          url: first.url ?? asset.url,
          urls: readySegs.map((s) => s.url!).filter(Boolean),
          id: asset.id,
          partial: true,
        };
      }
      // still some pending
      await supabase.from("mm_studio_assets").update({ metadata: { ...meta, segments: segs } }).eq("id", asset.id);
      return { status: "pending" as const, id: asset.id };
    }

    const allReady = segs.every((s) => s.status === "ready");
    if (!allReady) {
      await supabase.from("mm_studio_assets").update({ metadata: { ...meta, segments: segs } }).eq("id", asset.id);
      return { status: "pending" as const, id: asset.id };
    }

    const first = segs[0];
    await supabase
      .from("mm_studio_assets")
      .update({
        url: first.url ?? asset.url,
        thumb_url: first.url ?? null,
        metadata: { ...meta, segments: segs, status: "ready" },
      })
      .eq("id", asset.id);

    return {
      status: "ready" as const,
      url: first.url ?? asset.url,
      urls: segs.map((s) => s.url!).filter(Boolean),
      id: asset.id,
    };
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
