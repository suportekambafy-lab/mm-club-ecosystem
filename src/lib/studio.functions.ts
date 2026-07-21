import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STUDIO_COSTS, IMAGE_FORMATS, videoSegments, type ImageFormat, type ImageStyle } from "./studio-config";
import { buildImagePrompt, type BrandDna, type ProductCtx } from "./studio-prompt";

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
  notes: z.string().max(1000).optional(),
  count: z.number().int().min(1).max(4).default(4),
});

const OPENAI_IMAGE_MODEL = "gpt-image-1";

async function callImageModel(prompt: string, size: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY não configurada. Adiciona a chave nos secrets do backend.");
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt,
      size,
      quality: "medium",
      n: 1,
    }),
  });
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
      brand,
      product,
      notes: data.notes,
    });

    const generateOne = async (i: number) => {
      const b64 = await callImageModel(prompt, fmt.size);
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
  duration: z.number().int().min(8).max(10).default(8),
  objective: z.string().max(120).optional(),
  notes: z.string().max(1200).optional(),
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
    const product = productRes.data as { name?: string; category?: string; notes?: string } | null;

    const parts = [
      `Cinematic ${data.style} commercial video`,
      product?.name ? `featuring ${product.name}${product.category ? ` (${product.category})` : ""}` : null,
      brand?.brand_name ? `for brand ${brand.brand_name}` : null,
      brand?.tone ? `tone: ${brand.tone}` : null,
      data.objective ? `objective: ${data.objective}` : null,
      product?.notes ? `product notes: ${product.notes}` : null,
      brand?.description ? `brand: ${brand.description}` : null,
      data.notes ? `direction: ${data.notes}` : null,
      `about ${data.duration}s, smooth camera motion, dramatic lighting, premium color grading, 4k, no on-screen text, no logos.`,
    ].filter(Boolean).join(". ");

    // Spend credits upfront
    const { data: newBal, error: spendErr } = await supabase.rpc("mm_studio_spend_credits", {
      _user_id: userId,
      _amount: STUDIO_COSTS.video,
      _reason: "video_generation",
    });
    if (spendErr) {
      if (String(spendErr.message).includes("insufficient_credits")) {
        throw new Error("Créditos insuficientes para gerar vídeo.");
      }
      throw new Error(spendErr.message);
    }

    // Start Omni Flash interaction (background)
    const url = `https://generativelanguage.googleapis.com/v1beta/interactions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        model: OMNI_MODEL,
        input: parts,
        response_format: {
          type: "video",
          aspect_ratio: aspectFromFormat(data.format),
          delivery: "uri",
        },
        background: true,
        store: true,
        stream: false,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      await supabase.rpc("mm_studio_refund_credits", {
        _user_id: userId,
        _amount: STUDIO_COSTS.video,
        _reason: "video_generation_failed",
      });
      throw new Error(`Gemini Omni ${res.status}: ${text.slice(0, 240)}`);
    }
    const json = (await res.json()) as { id?: string };
    const interactionId = json.id;
    if (!interactionId) {
      await supabase.rpc("mm_studio_refund_credits", {
        _user_id: userId,
        _amount: STUDIO_COSTS.video,
        _reason: "video_generation_failed",
      });
      throw new Error("Omni não devolveu id de interação.");
    }

    const { data: asset, error: aErr } = await supabase
      .from("mm_studio_assets")
      .insert({
        user_id: userId,
        kind: "video",
        url: `pending://${interactionId}`,
        format: data.format,
        style: data.style,
        product_id: data.productId ?? null,
        credits_used: STUDIO_COSTS.video,
        metadata: {
          status: "pending",
          interaction_id: interactionId,
          prompt: parts,
          model: OMNI_MODEL,
          aspect: aspectFromFormat(data.format),
          duration: data.duration,
        },
      })
      .select("id")
      .single();
    if (aErr) throw new Error(aErr.message);

    return { assetId: asset.id, operation: interactionId, balance: newBal as number };
  });

export const pollVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ assetId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY não configurada.");

    const { data: asset, error } = await supabase
      .from("mm_studio_assets")
      .select("id, url, metadata")
      .eq("id", data.assetId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!asset) throw new Error("Asset não encontrado.");

    const meta = (asset.metadata ?? {}) as {
      status?: string;
      interaction_id?: string;
      operation?: string; // legacy
      prompt?: string;
      aspect?: string;
      duration?: number;
    };

    if (meta.status === "ready") {
      return { status: "ready" as const, url: asset.url, id: asset.id };
    }
    if (meta.status === "failed") {
      return { status: "failed" as const, id: asset.id, error: "Geração falhou." };
    }
    const interactionId = meta.interaction_id ?? meta.operation;
    if (!interactionId) throw new Error("Interação em falta.");

    const opUrl = `https://generativelanguage.googleapis.com/v1beta/interactions/${interactionId}`;
    const opRes = await fetch(opUrl, { headers: { "x-goog-api-key": key } });
    if (!opRes.ok) {
      const t = await opRes.text().catch(() => "");
      throw new Error(`Poll Omni ${opRes.status}: ${t.slice(0, 200)}`);
    }
    const op = (await opRes.json()) as {
      status?: string;
      error?: { message?: string };
      steps?: OmniStep[];
      output_video?: { uri?: string; data?: string; mime_type?: string };
    };

    const status = op.status ?? "pending";
    if (status === "failed" || status === "cancelled" || op.error) {
      await supabase
        .from("mm_studio_assets")
        .update({ metadata: { ...meta, status: "failed", error: op.error?.message } })
        .eq("id", asset.id);
      await supabase.rpc("mm_studio_refund_credits", {
        _user_id: userId,
        _amount: STUDIO_COSTS.video,
        _reason: "video_generation_failed",
      });
      return { status: "failed" as const, id: asset.id, error: op.error?.message ?? "Falhou." };
    }

    if (status !== "completed" && status !== "succeeded") {
      return { status: "pending" as const, id: asset.id };
    }

    const video = extractVideoFromInteraction(op);
    if (!video || (!video.uri && !video.data)) {
      throw new Error("Omni devolveu resposta sem vídeo.");
    }

    // Materialize bytes
    let buf: Uint8Array;
    const mime = video.mime ?? "video/mp4";
    if (video.uri) {
      // If it's a Files API URI, may need to poll ACTIVE; try a direct download first.
      let dl = await fetch(video.uri, { headers: { "x-goog-api-key": key } });
      if (!dl.ok && video.uri.includes("/files/")) {
        // Poll file state
        const name = video.uri.split("/files/")[1]?.split("?")[0];
        if (name) {
          for (let i = 0; i < 20; i++) {
            const info = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/files/${name}`,
              { headers: { "x-goog-api-key": key } },
            );
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
      // base64
      const bin = atob(video.data!);
      buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    }

    const ext = mime.includes("webm") ? "webm" : "mp4";
    const path = `${userId}/videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const up = await supabase.storage.from(BUCKET).upload(path, buf, {
      contentType: mime,
      upsert: false,
    });
    if (up.error) throw new Error(up.error.message);
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (signed.error || !signed.data) throw new Error(signed.error?.message ?? "URL falhou");

    const finalUrl = signed.data.signedUrl;
    await supabase
      .from("mm_studio_assets")
      .update({
        url: finalUrl,
        thumb_url: finalUrl,
        metadata: { ...meta, status: "ready", storage_path: path },
      })
      .eq("id", asset.id);

    return { status: "ready" as const, url: finalUrl, id: asset.id };
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
