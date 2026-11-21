/**
 * Direct AI providers for running outside Lovable (used by the outbound shim).
 *
 * Calls written for the Lovable AI gateway (OpenAI-compatible) are answered by:
 *   - OpenAI (OPENAI_API_KEY) for chat, embeddings, images and transcription;
 *   - Gemini (GEMINI_API_KEY) for video generation (/v1/videos, Veo).
 *
 * Model overrides: OPENAI_CHAT_MODEL, OPENAI_CHAT_MODEL_LITE, OPENAI_IMAGE_MODEL,
 * OPENAI_IMAGE_FALLBACK_MODEL, GEMINI_VIDEO_MODEL.
 */

const OPENAI_BASE = "https://api.openai.com/v1";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export function directAiEnabled(): boolean {
  const provider = env("AI_PROVIDER");
  if (provider) return provider === "openai";
  return !env("AI_GATEWAY_API_KEY") && !!env("OPENAI_API_KEY");
}

/** Maps a Lovable-gateway model id to the OpenAI model that replaces it. */
export function mapModel(model: string): string {
  if (model.startsWith("openai/")) {
    const name = model.slice("openai/".length);
    return name.startsWith("gpt-image") ? (env("OPENAI_IMAGE_MODEL") ?? name) : name;
  }
  if (model.startsWith("google/")) {
    if (model.includes("image")) return env("OPENAI_IMAGE_FALLBACK_MODEL") ?? "gpt-image-1";
    if (model.includes("lite")) return env("OPENAI_CHAT_MODEL_LITE") ?? "gpt-4.1-nano";
    return env("OPENAI_CHAT_MODEL") ?? "gpt-4.1-mini";
  }
  return model;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function dataUrlToBlob(url: string): Blob | null {
  const m = /^data:([^;,]+);base64,(.+)$/s.exec(url);
  if (!m) return null;
  return new Blob([Buffer.from(m[2], "base64")], { type: m[1] });
}

type Fetch = typeof fetch;

async function openai(original: Fetch, request: Request, path: string, search: string): Promise<Response> {
  const key = env("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const target = `${OPENAI_BASE}${path}${search}`;
  const auth = { authorization: `Bearer ${key}` };
  if (request.method === "GET" || request.method === "HEAD") {
    return original(target, { method: request.method, headers: auth, signal: request.signal });
  }

  const type = request.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await request.formData();
    const model = form.get("model");
    if (typeof model === "string") form.set("model", mapModel(model));
    return original(target, { method: request.method, headers: auth, body: form, signal: request.signal });
  }

  const body = JSON.parse((await request.text()) || "{}") as Record<string, any>;
  if (typeof body.model === "string") body.model = mapModel(body.model);

  // Gemini-style image request (chat messages on /images/generations): turn it into
  // an OpenAI image generation, or an image edit when reference images are attached.
  if (path === "/images/generations" && Array.isArray(body.messages)) {
    const parts = body.messages.flatMap((m: any) => (Array.isArray(m?.content) ? m.content : [{ type: "text", text: String(m?.content ?? "") }]));
    const prompt = parts.filter((p: any) => p?.type === "text").map((p: any) => p.text).join("\n").trim();
    const images = parts
      .filter((p: any) => p?.type === "image_url")
      .map((p: any) => dataUrlToBlob(String(p.image_url?.url ?? "")))
      .filter((b: Blob | null): b is Blob => !!b);
    if (images.length > 0) {
      const form = new FormData();
      form.append("model", body.model);
      form.append("prompt", prompt);
      form.append("n", "1");
      images.slice(0, 4).forEach((blob: Blob, i: number) => form.append("image[]", blob, `ref-${i}.${blob.type.includes("jpeg") ? "jpg" : "png"}`));
      return original(`${OPENAI_BASE}/images/edits`, { method: "POST", headers: auth, body: form, signal: request.signal });
    }
    return original(target, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ model: body.model, prompt, n: 1 }),
      signal: request.signal,
    });
  }

  return original(target, {
    method: request.method,
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: request.signal,
  });
}

// ---- Video: emulate the gateway's /v1/videos API on top of Gemini (Veo) ----

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64url = (s: string) => Buffer.from(s, "base64url").toString("utf8");

async function geminiVideo(original: Fetch, request: Request, path: string): Promise<Response> {
  const key = env("GEMINI_API_KEY");
  if (!key) return json(503, { error: { message: "GEMINI_API_KEY is not configured" } });
  const headers = { "x-goog-api-key": key, "content-type": "application/json" };
  const model = env("GEMINI_VIDEO_MODEL") ?? "veo-3.1-fast-generate-preview";

  if (request.method === "POST" && path === "/videos") {
    const body = JSON.parse((await request.text()) || "{}") as Record<string, any>;
    const instance: Record<string, unknown> = { prompt: String(body.prompt ?? "") };
    const ref = typeof body.input_reference === "string" ? /^data:([^;,]+);base64,(.+)$/s.exec(body.input_reference) : null;
    if (ref) instance.image = { mimeType: ref[1], bytesBase64Encoded: ref[2] };
    const portrait = String(body.size ?? "").startsWith("720x");
    const res = await original(`${GEMINI_BASE}/models/${model}:predictLongRunning`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        instances: [instance],
        parameters: { aspectRatio: portrait ? "9:16" : "16:9", durationSeconds: Number(body.seconds ?? 8) || 8 },
      }),
    });
    const out: any = await res.json().catch(() => null);
    if (!res.ok || !out?.name) return json(res.ok ? 502 : res.status, { error: { message: out?.error?.message ?? "Gemini video request failed" } });
    return json(200, { id: b64url(out.name), status: "queued" });
  }

  const match = /^\/videos\/([A-Za-z0-9_-]+)(\/content)?$/.exec(path);
  if (request.method === "GET" && match) {
    const name = unb64url(match[1]);
    if (!/^models\/[A-Za-z0-9._-]+\/operations\/[A-Za-z0-9._-]+$/.test(name)) return json(400, { error: { message: "invalid video id" } });
    const res = await original(`${GEMINI_BASE}/${name}`, { headers });
    const op: any = await res.json().catch(() => null);
    if (!res.ok) return json(res.status, { error: { message: op?.error?.message ?? "Gemini operation lookup failed" } });
    const uri: string | undefined = op?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;

    if (!match[2]) {
      if (op?.error) return json(200, { id: match[1], status: "failed", error: { message: op.error.message ?? "A geração de vídeo falhou." } });
      if (!op?.done) return json(200, { id: match[1], status: "in_progress" });
      if (!uri) return json(200, { id: match[1], status: "failed", error: { message: "O Gemini não devolveu vídeo (pedido recusado pelos filtros)." } });
      return json(200, { id: match[1], status: "completed" });
    }
    if (!uri) return json(404, { error: { message: "video not ready" } });
    const file = await original(uri, { headers: { "x-goog-api-key": key }, redirect: "follow" });
    return new Response(file.body, { status: file.status, headers: { "content-type": file.headers.get("content-type") ?? "video/mp4" } });
  }

  return json(404, { error: { message: "unsupported video route" } });
}

/** Answers a Lovable AI gateway request with OpenAI (or Gemini for video). */
export async function handleDirectAi(original: Fetch, request: Request, url: URL): Promise<Response> {
  const path = url.pathname.replace(/^\/v1/, "");
  if (path === "/videos" || path.startsWith("/videos/")) return geminiVideo(original, request, path);
  return openai(original, request, path, url.search);
}
