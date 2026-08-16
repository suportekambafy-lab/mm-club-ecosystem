// Motor de geração de vídeo do MM Studio.
// Usa o Lovable AI Gateway (/v1/videos, Veo 3.1) — sem chaves de terceiros.
// Server-only: nunca importar no cliente nem no module scope de *.functions.ts.

const GATEWAY = "https://ai.gateway.lovable.dev/v1/videos";
export const VIDEO_MODEL = "google/veo-3.1-fast";

export type VideoAspect = "9:16" | "1:1" | "16:9";

/** Veo aceita apenas 4, 6 ou 8 segundos por clipe. */
export function normalizeSeconds(seconds: number): "4" | "6" | "8" {
  if (seconds <= 4) return "4";
  if (seconds <= 6) return "6";
  return "8";
}

/** Veo aceita apenas tamanhos fixos; 1:1 cai para paisagem. */
export function sizeFromAspect(aspect: VideoAspect): string {
  return aspect === "9:16" ? "720x1280" : "1280x720";
}

function apiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY não configurada.");
  return key;
}

function b64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/** Cria um job de vídeo e devolve o id. */
export async function startVideoJob(opts: {
  prompt: string;
  aspect: VideoAspect;
  seconds: number;
  ref?: { bytes: Uint8Array; mime: string } | null;
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: VIDEO_MODEL,
    prompt: opts.prompt,
    seconds: normalizeSeconds(opts.seconds),
    size: sizeFromAspect(opts.aspect),
  };
  if (opts.ref) {
    const mime = opts.ref.mime.startsWith("image/") ? opts.ref.mime : "image/jpeg";
    body.input_reference = `data:${mime};base64,${b64(opts.ref.bytes)}`;
  }

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 402) throw new Error("Sem saldo de IA disponível para gerar vídeo agora.");
    if (res.status === 429) throw new Error("Demasiados vídeos em geração — tenta novamente em instantes.");
    throw new Error(`Geração de vídeo falhou (${res.status}): ${text.slice(0, 220)}`);
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("O serviço de vídeo não devolveu identificador de job.");
  return json.id;
}

export type VideoJobStatus = {
  status: "pending" | "completed" | "failed";
  error?: { message?: string };
};

export async function pollVideoJob(jobId: string): Promise<VideoJobStatus> {
  const res = await fetch(`${GATEWAY}/${jobId}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Estado do vídeo (${res.status}): ${t.slice(0, 200)}`);
  }
  const job = (await res.json()) as {
    status?: string;
    error?: { code?: string; message?: string };
  };
  if (job.status === "completed") return { status: "completed" };
  if (job.status === "failed" || job.error) {
    return {
      status: "failed",
      error: { message: job.error?.message ?? "A geração de vídeo falhou." },
    };
  }
  return { status: "pending" };
}

/** Descarrega o MP4 de um job concluído (o 302 é seguido automaticamente). */
export async function downloadVideoBytes(jobId: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const res = await fetch(`${GATEWAY}/${jobId}/content`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) throw new Error(`Download do vídeo falhou (${res.status}).`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error("O serviço de vídeo devolveu ficheiro vazio.");
  return { bytes, mime: "video/mp4" };
}
