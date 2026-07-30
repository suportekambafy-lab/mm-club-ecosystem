const COURSE_COVER_BUCKET = "course-media";
const COURSE_COVER_SIGN_TTL = 60 * 60 * 24 * 365 * 10;

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

/**
 * Gera uma capa cinematográfica MM Club para um curso (mesmo motor das capas de lives).
 * Quando é fornecida a foto do autor/especialista, a pessoa é usada como sujeito principal.
 */
export async function generateAndStoreCourseCover({
  courseId,
  title,
  tagline,
  supabaseAdmin,
  authorImageUrl,
}: {
  courseId: string;
  title: string;
  tagline?: string | null;
  supabaseAdmin: SupabaseAdminLike;
  authorImageUrl?: string;
}): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada para gerar capas.");

  const prompt = buildCourseCoverPrompt(title, tagline, Boolean(authorImageUrl));

  let b64: string | undefined;

  if (authorImageUrl) {
    const imgRes = await fetch(authorImageUrl);
    if (!imgRes.ok) throw new Error(`Falha ao carregar a foto do autor (${imgRes.status}).`);
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
      throw new Error(`Falha ao gerar capa com autor (${res.status}): ${text.slice(0, 220)}`);
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
  const safeId = courseId.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 60);
  const path = `courses/${safeId}/ai-cover/${Date.now()}.png`;
  const upload = await supabaseAdmin.storage.from(COURSE_COVER_BUCKET).upload(path, bytes, {
    contentType: "image/png",
    cacheControl: "31536000",
    upsert: false,
  });
  if (upload.error) throw new Error(upload.error.message);

  const signed = await supabaseAdmin.storage
    .from(COURSE_COVER_BUCKET)
    .createSignedUrl(path, COURSE_COVER_SIGN_TTL);
  if (signed.error || !signed.data) throw new Error(signed.error?.message ?? "Falha ao assinar capa.");
  return signed.data.signedUrl;
}

function buildCourseCoverPrompt(
  title: string,
  tagline: string | null | undefined,
  withAuthor: boolean,
): string {
  const cleanTitle = title.trim().toUpperCase();
  const cleanTagline = (tagline ?? "").trim();

  const base = [
    "Ultra-premium cinematic 16:9 (wide landscape) cover image for an online course inside the MM Club luxury digital entrepreneurs brand.",
    "Visual direction: deep matte black background, warm golden key light, soft golden bokeh, subtle floating gold dust, elegant Apple TV / MasterClass energy, dramatic depth, refined contrast, editorial fashion-photography quality.",
    `TYPOGRAPHY (required): render the exact course title "${cleanTitle}" on the LEFT side of the image, vertically centered, in a beautiful high-end typeface — an elegant modern serif or refined luxury display font — in warm gold (#E4C07A) with subtle metallic sheen, generous letter-spacing, set on two or three balanced lines.`,
    cleanTagline
      ? `Under the title, in a much smaller, thin uppercase sans-serif in soft warm grey, render exactly: "${cleanTagline}". No other words.`
      : "No other words besides the title.",
    "Text rules: spelling must be perfect and identical to the given text, no invented words, no duplicated text, no gibberish letters. The typography must sit fully inside the frame with a comfortable margin from every edge — never touching or clipped by the borders. Keep the left area dark and clean so the type reads with high contrast.",
    "Composition: title block occupies the left third to left half; the visual subject occupies the right side. Everything important stays well within the safe area so the image never looks cropped when displayed as a wide hero, a 16:9 card or a rounded thumbnail.",
    "ABSOLUTELY NO LOGOS or brand marks, no 'MM CLUB' logo, no crown, no monogram, no badge, no watermark, no signature.",
    "No UI elements, no play buttons, no mockup screens, no fake dashboards, no clutter.",
  ];

  if (withAuthor) {
    base.splice(
      2,
      0,
      "Use the person in the provided reference photo as the main subject. Keep their face, hairstyle, ethnicity, skin tone and identity 100% recognizable — do not invent a different person, do not stylize into illustration or 3D.",
      "Frame the author as a confident head-and-shoulders cinematic portrait placed on the RIGHT side, fully inside the frame with clear margin above the hair and below the shoulders — never crop the head, hair, ears or shoulders. Golden rim light on the silhouette, blurred golden bokeh studio background, MasterClass instructor framing. Leave the left side dark and uncluttered for the title typography.",
    );
  }

  return base.join(" ");
}
