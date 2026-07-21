// Prompt builder — determinístico. Utilizador nunca vê o resultado.
import type { ImageFormat, ImageStyle, VideoFormat, VideoStyle } from "./studio-config";

export type BrandDna = {
  brand_name?: string | null;
  colors?: string[] | null;
  typography?: string | null;
  segment?: string | null;
  audience?: string | null;
  tone?: string | null;
  description?: string | null;
} | null;

export type ProductCtx = {
  name?: string | null;
  category?: string | null;
  brand_colors?: string[] | null;
  notes?: string | null;
} | null;

const STYLE_DIRECTIVES: Record<ImageStyle, string> = {
  luxo: "opulent luxury aesthetic, marble surface, warm gold rim light, editorial magazine composition",
  minimalista: "minimalist composition, generous negative space, muted palette, gallery lighting",
  apple: "clean Apple-style product shot, seamless white cyclorama, soft shadow, ultra-sharp focus",
  premium: "premium cinematic mood, deep shadows, rich textures, shallow depth of field",
  tecnologia: "high-tech scene, dark surface, neon rim accents, subtle grid reflections",
  moda: "high-fashion editorial, dramatic contrast, styled composition, Vogue-cover energy",
  beleza: "beauty campaign, soft skin-tone palette, macro clarity, dewy highlights",
  comida: "gourmet food photography, side light, gentle steam, appetizing textures",
  fitness: "dynamic sport aesthetic, sweat highlights, athletic energy, dramatic side light",
  elegante: "timeless elegance, calm palette, refined props, museum-quality lighting",
  escuro: "dark mode composition, deep charcoal background, warm golden accents",
  claro: "bright high-key, airy palette, sunlit softness, fresh minimalism",
  lifestyle: "in-context lifestyle scene, natural human touch, real environment, candid framing",
  estudio: "professional studio shot, softbox lighting, clean seamless backdrop, product hero",
};

const FORMAT_DIRECTIVES: Record<ImageFormat, string> = {
  ig_feed: "square 1:1 Instagram feed composition, product-centered, thumb-stop hook",
  ig_story: "vertical 9:16 Instagram Story composition, safe zones top and bottom for UI",
  ig_reels_cover: "vertical 9:16 Reels cover, bold focal point, punchy visual hierarchy",
  facebook: "square 1:1 Facebook ad composition, clean and scroll-stopping",
  tiktok: "vertical 9:16 TikTok composition, native mobile framing, high contrast",
  loja: "square 1:1 e-commerce hero, isolated product, catalog-ready",
  banner: "horizontal 16:9 web banner, cinematic wide shot, hero product to one side",
  thumbnail: "horizontal 16:9 thumbnail, bold subject, clear focal contrast",
};

export function buildImagePrompt(input: {
  style: ImageStyle;
  format: ImageFormat;
  brand: BrandDna;
  product: ProductCtx;
  notes?: string;
}): string {
  const parts: string[] = [];
  parts.push("Professional advertising photograph.");
  parts.push(STYLE_DIRECTIVES[input.style]);
  parts.push(FORMAT_DIRECTIVES[input.format]);

  if (input.product?.name) {
    parts.push(`Featured product: "${input.product.name}"${input.product.category ? ` (${input.product.category})` : ""}.`);
  }
  const colors = input.product?.brand_colors?.length ? input.product.brand_colors : input.brand?.colors;
  if (colors && colors.length) parts.push(`Brand color palette: ${colors.join(", ")}.`);
  if (input.brand?.brand_name) parts.push(`Brand: ${input.brand.brand_name}.`);
  if (input.brand?.tone) parts.push(`Brand tone: ${input.brand.tone}.`);
  if (input.brand?.audience) parts.push(`Target audience: ${input.brand.audience}.`);
  if (input.brand?.description) parts.push(`Brand context: ${input.brand.description}.`);
  if (input.product?.notes) parts.push(`Product notes: ${input.product.notes}.`);
  if (input.notes) parts.push(`Additional direction: ${input.notes}.`);

  parts.push(
    "Ultra-realistic, tack-sharp, commercial-grade advertising, natural product materials, no text, no watermark, no logo overlays.",
  );
  return parts.join(" ");
}

export function buildVideoPrompt(input: {
  style: VideoStyle;
  format: VideoFormat;
  duration: number;
  objective: string;
  brand: BrandDna;
  product: ProductCtx;
}): string {
  const parts: string[] = [];
  parts.push(`${input.duration}-second professional product advertisement video.`);
  parts.push(`Style: ${input.style.replace("_", " ")}, cinematic camera moves, elegant transitions, premium lighting.`);
  parts.push(`Format: ${input.format} native aspect.`);
  parts.push(`Objective: ${input.objective}.`);
  if (input.product?.name) parts.push(`Hero product: ${input.product.name}.`);
  if (input.brand?.brand_name) parts.push(`Brand: ${input.brand.brand_name}.`);
  if (input.brand?.tone) parts.push(`Tone: ${input.brand.tone}.`);
  parts.push("Storyboard: hero reveal, detail macro, in-context beauty shot, closing brand moment. Smooth motion, depth of field, no on-screen text.");
  return parts.join(" ");
}
