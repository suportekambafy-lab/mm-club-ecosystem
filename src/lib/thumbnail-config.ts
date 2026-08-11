// MM Thumbnail Builder — configuração partilhada entre servidor e cliente.
import { STUDIO_COSTS } from "./studio-config";

export const THUMB_VARIANTS = 2;
export const THUMB_COST_PER_VARIANT = STUDIO_COSTS.imageSingle;
export const THUMB_BATCH_COST = THUMB_VARIANTS * THUMB_COST_PER_VARIANT;
export const THUMB_SIZE = "1536x1024";

export type ThumbStyle =
  | "mrbeast"
  | "premium"
  | "documentario"
  | "podcast"
  | "tutorial"
  | "minimal";

export const THUMB_STYLES: { id: ThumbStyle; label: string; hint: string; prompt: string }[] = [
  {
    id: "mrbeast",
    label: "Alto impacto",
    hint: "Cores saturadas, contraste extremo",
    prompt:
      "explosive high-CTR youtube thumbnail style: hyper-saturated colours, extreme contrast, thick clean outlines around the subject, punchy depth, dramatic rim light, bold graphic shapes",
  },
  {
    id: "premium",
    label: "Premium escuro",
    hint: "Preto mate, dourado, cinematográfico",
    prompt:
      "premium cinematic thumbnail: deep matte black background, warm golden key light, elegant depth and bokeh, refined luxury business aesthetic",
  },
  {
    id: "documentario",
    label: "Documentário",
    hint: "Realista, editorial, jornalístico",
    prompt:
      "documentary/editorial thumbnail: realistic photography, natural colour grading, cinematic composition, serious credible tone",
  },
  {
    id: "podcast",
    label: "Podcast",
    hint: "Estúdio, microfone, dois planos",
    prompt:
      "podcast episode thumbnail: studio setting with microphone, moody coloured lighting, conversational energy, clean framing",
  },
  {
    id: "tutorial",
    label: "Tutorial / Tech",
    hint: "Ecrãs, setas, elementos de UI",
    prompt:
      "tech tutorial thumbnail: clean digital composition with abstract app interface panels, arrows and highlight shapes, crisp modern colours",
  },
  {
    id: "minimal",
    label: "Minimal",
    hint: "Um objeto, muito espaço negativo",
    prompt:
      "ultra-minimal thumbnail: single hero object, generous negative space, one accent colour, gallery-grade lighting",
  },
];

export type ThumbInput = {
  style: ThumbStyle;
  headline: string;
  topic: string;
  channel?: string;
  notes?: string;
};

export function buildThumbnailPrompt(
  input: ThumbInput,
  variantDirection: string,
  hasFrame = false,
): string {
  const style = THUMB_STYLES.find((s) => s.id === input.style) ?? THUMB_STYLES[0];
  const headline = input.headline.trim().toUpperCase();

  return [
    "You are a world-class YouTube thumbnail art director. Produce a finished, print-quality 16:9 landscape thumbnail — edge-to-edge artwork, no borders, no letterboxing, no frame, no mockup.",
    hasFrame
      ? [
          "The attached image is a frame from the actual video. Use the real person/scene from it as the hero subject and keep their face, hairstyle, skin tone, body type, clothing and identity 100% recognizable — never invent a different person and never stylize into illustration or cartoon.",
          "Cut the subject out of the original frame and rebuild the background from scratch with the art direction below: clean professional cut-out with a subtle rim light or thin outline for separation, retouched skin, corrected exposure and colour, sharp eyes.",
          "Discard everything else from the frame — original background clutter, any existing text, captions, logos, watermarks, subtitles, UI or player elements must not appear.",
        ].join(" ")
      : "Invent a single striking hero subject that instantly communicates the topic — a real, photographic human or object, never flat vector art.",
    `Video topic: ${input.topic}.`,
    input.channel ? `Channel/brand context: ${input.channel}.` : "",
    `Art direction: ${style.prompt}.`,
    "Craft: professional studio lighting, cinematic colour grading, crisp micro-contrast, believable shadows and depth of field, high dynamic range, no muddy tones, no plastic AI sheen, no blurry or melted details, no extra fingers or distorted faces.",
    `Render this EXACT short headline as the only text in the image, spelled character by character exactly as written: "${headline}".`,
    "Typography: heavy condensed sans-serif, huge (headline height around 22-30% of the image), tight tracking, pure white or the single accent colour, with a hard drop shadow or thick outline so it stays legible over anything. Keep it fully inside the frame with generous margin, on the opposite side of the subject's face, never covering the eyes. Maximum 5 words on at most 2 lines.",
    "Spelling must be perfect — no invented, duplicated, cropped or garbled letters. No second block of text, no watermark, no logo, no channel name, no play button, no YouTube UI, no progress bar, no duration badge, no emoji.",
    "Composition: strong figure/ground separation, clear focal hierarchy, subject occupying roughly 40-55% of the frame, high contrast between subject and background so it still reads at 320px wide on a phone.",
    variantDirection,
    input.notes ? `Extra direction: ${input.notes}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export const THUMB_VARIANT_DIRECTIONS = [
  "Variation A: subject anchored on the right two-thirds in a medium shot with an expressive, high-energy facial expression; headline stacked on the left third; background uses a bold gradient plus soft glow behind the subject.",
  "Variation B: clearly different concept — tight close-up crop of the face/object, different accent colour, headline anchored across the bottom on a solid contrast band, plus one simple supporting graphic element (arrow, circle highlight or number) that reinforces the topic.",
];


/** Extrai o ID do vídeo de qualquer formato de link do YouTube. */
export function parseYouTubeId(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?[^#]*\bv=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/(?:embed|shorts|live)\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = p.exec(url);
    if (m) return m[1];
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
  return null;
}
