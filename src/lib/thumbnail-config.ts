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

export function buildThumbnailPrompt(input: ThumbInput, variantDirection: string): string {
  const style = THUMB_STYLES.find((s) => s.id === input.style) ?? THUMB_STYLES[0];
  const headline = input.headline.trim().toUpperCase();

  return [
    "Design a 16:9 YouTube video thumbnail (landscape), edge-to-edge artwork, no borders, no letterboxing.",
    `Video topic: ${input.topic}.`,
    input.channel ? `Channel/brand context: ${input.channel}.` : "",
    `Art direction: ${style.prompt}.`,
    `Render this EXACT short headline as the only text in the image, spelled character by character exactly as written: "${headline}".`,
    "Typography: very bold heavy sans-serif, huge, perfectly legible at small size, placed on one side with a clear contrast plate or outline so it never fights the subject. Maximum 5 words. No other text, no watermark, no logo, no channel name, no play button, no YouTube UI, no duration badge.",
    "Spelling must be perfect — no invented, duplicated or garbled letters.",
    "Composition: one clear focal subject, strong figure/ground separation, readable as a small mobile thumbnail.",
    variantDirection,
    input.notes ? `Extra direction: ${input.notes}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export const THUMB_VARIANT_DIRECTIONS = [
  "Variation A: subject on the right, headline on the left third.",
  "Variation B: a clearly different concept — closer crop, different colour accent, headline anchored at the bottom.",
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
