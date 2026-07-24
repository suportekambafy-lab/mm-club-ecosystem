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
  speakerImageUrl,
}: {
  liveId: string;
  title: string;
  startsAt: string;
  supabaseAdmin: SupabaseAdminLike;
  speakerImageUrl?: string;
}): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada para gerar capas.");

  const prompt = buildLiveCoverPrompt(title, startsAt, Boolean(speakerImageUrl));

  let b64: string | undefined;

  if (speakerImageUrl) {
    // Fetch speaker image and inline it as data URL for reliable multimodal input.
    const imgRes = await fetch(speakerImageUrl);
    if (!imgRes.ok) throw new Error(`Falha ao carregar foto do palestrante (${imgRes.status}).`);
    const buf = new Uint8Array(await imgRes.arrayBuffer());
    const mime = imgRes.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const dataUrl = `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Falha ao gerar capa com palestrante (${res.status}): ${text.slice(0, 220)}`);
    }
    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    b64 = json.data?.[0]?.b64_json;
  } else {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
    b64 = json.data?.[0]?.b64_json;
  }

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

function buildLiveCoverPrompt(_title: string, _startsAt: string, withSpeaker: boolean): string {
  const base = [
    "Ultra-premium cinematic 16:9 background image for a livestream cover in the MM Club luxury digital entrepreneurs brand.",
    "Visual direction: deep matte black stage, warm golden spotlights, soft golden bokeh, subtle floating gold dust particles, elegant Apple TV / MasterClass energy, dramatic depth, refined contrast, editorial fashion-photography quality.",
    "Composition: subject and lighting kept centered and balanced so the image works when cropped both as a wide 21:9 hero banner and as a smaller card, with enough dark negative space on the left and bottom for app UI overlays.",
    "ABSOLUTELY NO TEXT of any kind in the image: no titles, no captions, no letters, no numbers, no dates, no timers, no watermarks, no signatures.",
    "ABSOLUTELY NO LOGOS or brand marks of any kind, including no 'MM CLUB' logo, no crown, no monogram, no badge, no shield.",
    "ABSOLUTELY NO 'AO VIVO' / 'LIVE' / 'NOW' badges, no red pills, no broadcast indicators, no UI elements — those are added on top by the app.",
    "Do not invent fake product covers, fake screenshots, or clutter.",
  ];

  if (withSpeaker) {
    base.splice(
      1,
      0,
      "Use the person in the provided reference photo as the main subject. Keep their face, hairstyle, ethnicity, skin tone and identity 100% recognizable — do not invent a different person, do not stylize into illustration.",
      "Frame the subject as a full head-and-shoulders cinematic portrait, fully inside the image with clear margin on all sides — never crop the head, hair, hands or shoulders. Position the subject slightly right of center so the left third stays as dark cinematic negative space for app UI. Dramatic golden rim light on the silhouette, blurred golden bokeh stage background, MasterClass-style keynote framing.",
    );
  }

  return base.join(" ");
}

