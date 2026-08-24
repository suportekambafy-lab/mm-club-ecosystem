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

async function toDataUrl(url: string, label: string): Promise<string> {
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`Falha ao carregar ${label} (${imgRes.status}).`);
  const buf = new Uint8Array(await imgRes.arrayBuffer());
  const mime = imgRes.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
}

export async function generateAndStoreLiveCover({
  liveId,
  title,
  startsAt,
  supabaseAdmin,
  speakerImageUrl,
  guestImageUrl,
  pathPrefix,
}: {
  liveId: string;
  title: string;
  startsAt: string;
  supabaseAdmin: SupabaseAdminLike;
  speakerImageUrl?: string;
  guestImageUrl?: string;
  pathPrefix?: string;
}): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada para gerar capas.");

  const people = [speakerImageUrl, guestImageUrl].filter(Boolean) as string[];
  const prompt = buildLiveCoverPrompt(title, startsAt, people.length);

  let b64: string | undefined;

  if (people.length > 0) {
    // Fetch reference photos and inline them as data URLs for reliable multimodal input.
    const dataUrls: string[] = [];
    for (const [i, u] of people.entries()) {
      dataUrls.push(await toDataUrl(u, i === 0 && speakerImageUrl ? "foto do palestrante" : "foto do convidado"));
    }

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
              ...dataUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Falha ao gerar capa com pessoas (${res.status}): ${text.slice(0, 220)}`);
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
  const path = `${pathPrefix ?? "lives-covers"}/${liveId}/ai-cover-${Date.now()}.png`;
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

function buildLiveCoverPrompt(_title: string, _startsAt: string, peopleCount: number): string {
  const base = [
    "Ultra-premium cinematic 16:9 background image for a livestream cover in the MM Club luxury digital entrepreneurs brand.",
    "Visual direction: deep matte black stage, warm golden spotlights, soft golden bokeh, subtle floating gold dust particles, elegant Apple TV / MasterClass energy, dramatic depth, refined contrast, editorial fashion-photography quality.",
    "Composition: subject and lighting kept centered and balanced so the image works when cropped both as a wide 21:9 hero banner and as a smaller card, with enough dark negative space on the left and bottom for app UI overlays.",
    "ABSOLUTELY NO TEXT of any kind in the image: no titles, no captions, no letters, no numbers, no dates, no timers, no watermarks, no signatures.",
    "ABSOLUTELY NO LOGOS or brand marks of any kind, including no 'MM CLUB' logo, no crown, no monogram, no badge, no shield.",
    "ABSOLUTELY NO 'AO VIVO' / 'LIVE' / 'NOW' badges, no red pills, no broadcast indicators, no UI elements — those are added on top by the app.",
    "Do not invent fake product covers, fake screenshots, or clutter.",
  ];

  if (peopleCount === 1) {
    base.splice(
      1,
      0,
      "Use the person in the provided reference photo as the main subject. Keep their face, hairstyle, ethnicity, skin tone and identity 100% recognizable — do not invent a different person, do not stylize into illustration.",
      "Frame the subject as a full head-and-shoulders cinematic portrait, fully inside the image with clear margin on all sides — never crop the head, hair, hands or shoulders. Position the subject slightly right of center so the left third stays as dark cinematic negative space for app UI. Dramatic golden rim light on the silhouette, blurred golden bokeh stage background, MasterClass-style keynote framing.",
    );
  } else if (peopleCount >= 2) {
    base.splice(
      1,
      0,
      "Use BOTH people from the two provided reference photos in the same image: the first photo is the host/speaker, the second photo is the guest. Keep each face, hairstyle, ethnicity, skin tone and identity 100% recognizable — do not merge them into one person, do not invent extra people, do not stylize into illustration.",
      "Compose them side by side as a two-person cinematic keynote portrait (head-and-shoulders), both fully inside the frame with clear margin on all sides — never crop heads, hair or shoulders. Place the pair slightly right of center so the left third stays as dark cinematic negative space for app UI. Matching golden rim light on both silhouettes, consistent lighting and scale between the two, blurred golden bokeh stage background, MasterClass-style duo interview framing.",
    );
  }

  return base.join(" ");
}

