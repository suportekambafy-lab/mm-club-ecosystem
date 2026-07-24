const LIVE_COVER_BUCKET = "course-media";
const LIVE_COVER_SIGN_TTL = 60 * 60 * 24 * 365 * 10;

type SupabaseAdminLike = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: Uint8Array,
        options: { contentType: string; cacheControl?: string; upsert?: boolean },
      ) => Promise<{ error: { message: string } | null }>;
      createSignedUrl: (
        path: string,
        ttl: number,
      ) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
    };
  };
};

export async function generateAndStoreLiveCover({
  liveId,
  title,
  startsAt,
  supabaseAdmin,
}: {
  liveId: string;
  title: string;
  startsAt: string;
  supabaseAdmin: SupabaseAdminLike;
}): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada para gerar capas.");

  const prompt = buildLiveCoverPrompt(title, startsAt);
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-image-2",
      prompt,
      size: "1536x1024",
      quality: "high",
      n: 1,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Falha ao gerar capa (${res.status}): ${text.slice(0, 220)}`);
  }

  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("A IA não devolveu imagem para a capa.");

  const bytes = Uint8Array.from(Buffer.from(b64, "base64"));
  const path = `lives-covers/${liveId}/ai-cover-${Date.now()}.png`;
  const upload = await supabaseAdmin.storage.from(LIVE_COVER_BUCKET).upload(path, bytes, {
    contentType: "image/png",
    cacheControl: "31536000",
    upsert: false,
  });
  if (upload.error) throw new Error(upload.error.message);

  const signed = await supabaseAdmin.storage.from(LIVE_COVER_BUCKET).createSignedUrl(path, LIVE_COVER_SIGN_TTL);
  if (signed.error || !signed.data) throw new Error(signed.error?.message ?? "Falha ao assinar capa.");
  return signed.data.signedUrl;
}

function buildLiveCoverPrompt(title: string, startsAt: string): string {
  const date = new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(startsAt));

  return [
    "Premium cinematic 16:9 livestream cover for MM Club, a luxury digital entrepreneurs community.",
    "Visual direction: deep black stage, warm golden spotlights, subtle gold dust, elegant Apple TV / MasterClass energy, high-end Portuguese business event, dramatic depth, refined contrast, no cartoon, no generic stock-photo look.",
    `Main typography must be large, modern, crisp and readable with the exact Portuguese title: “${title}”.`,
    "Add a polished red live badge with the exact words “AO VIVO AGORA” and a small refined “MM CLUB” brand mark.",
    `If a date appears, use: “${date}”.`,
    "Use beautiful editorial typography, generous spacing, black/gold palette, professional event poster composition, enough dark negative space so app overlays remain readable.",
    "Do not create fake product covers, fake course screenshots, fake logos beyond MM CLUB, watermarks, misspelled text, random people, or clutter.",
  ].join(" ");
}