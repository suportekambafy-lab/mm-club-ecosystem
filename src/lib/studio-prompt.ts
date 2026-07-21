// Prompt builder — determinístico. Focado em alta conversão.
import type {
  ConversionHook,
  ImageFormat,
  ImageStyle,
  PeoplePreset,
  SceneMode,
  VideoFormat,
  VideoStyle,
} from "./studio-config";

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
  ig_feed: "square 1:1 Instagram feed composition, product-centered, thumb-stop hook in the first 0.5 second of viewing",
  ig_story: "vertical 9:16 Instagram Story, hero product in the central safe zone, negative space at top and bottom for UI and swipe-up",
  ig_reels_cover: "vertical 9:16 Reels cover, single bold focal point, punchy visual hierarchy, high-contrast subject vs background",
  facebook: "square 1:1 Facebook ad, scroll-stopping subject, high thumbnail readability at 120px",
  tiktok: "vertical 9:16 TikTok native framing, high-contrast, mobile-first, subject fills 70% of the frame",
  loja: "square 1:1 e-commerce hero, isolated product, catalog-ready, crisp edges, e-commerce compliant",
  banner: "horizontal 16:9 web banner, cinematic wide shot, hero product placed on the rule-of-thirds, breathing room for headline",
  thumbnail: "horizontal 16:9 thumbnail, one clear subject, high focal contrast, readable at 320px",
};

const SCENE_DIRECTIVES: Record<SceneMode, string> = {
  ecommerce_white:
    "pure #FFFFFF seamless background, product isolated, tack-sharp edges, soft contact shadow, catalogue-grade — Amazon/Shopify hero standards, no props competing with the product",
  ecommerce_black:
    "pure #0A0A0A seamless background, dramatic rim light, luxury product hero shot, subtle floor reflection",
  ecommerce_gradient:
    "smooth premium gradient background (brand-aligned), soft studio light, product hero-centered, gentle contact shadow",
  studio_seamless:
    "professional studio cyclorama, softbox key light + subtle rim light, clean shadow under the product, commercial catalogue quality",
  lifestyle:
    "authentic in-use lifestyle context, natural environment matching the audience, realistic props, product remains the visual hero",
  editorial:
    "magazine editorial composition, styled surfaces, dramatic contrast, art-directed props, one clear focal point",
  outdoor:
    "natural outdoor location, golden-hour or overcast soft light, real-world texture, product in a believable moment of use",
};

const PEOPLE_DIRECTIVES: Record<PeoplePreset, string> = {
  none: "no people in frame — product is the sole hero",
  hands:
    "only clean, well-manicured hands visible interacting naturally with the product; face is out of frame; hands complement the product, never obscure the label",
  woman:
    "one confident, aspirational female model (late 20s–30s), natural expression, direct or three-quarter gaze, styled hair and wardrobe matching the brand tone; product held or worn clearly and legibly",
  man:
    "one confident, aspirational male model (late 20s–30s), natural expression, direct or three-quarter gaze, styled hair and wardrobe matching the brand tone; product held or worn clearly and legibly",
  couple:
    "one man and one woman together, natural chemistry, aspirational lifestyle, both engaged with the product moment; brand tone reflected in styling",
  group:
    "3–4 diverse people, joyful genuine social scene, product visible and central to the moment; inclusive representation",
};

const HOOK_DIRECTIVES: Record<ConversionHook, string> = {
  none: "",
  problem_solution:
    "visual framing that instantly implies a common pain point being resolved by the product; before-state tension resolved in the composition",
  before_after:
    "clean split-screen or juxtaposition suggesting transformation, product as the catalyst",
  social_proof:
    "context that suggests popularity and desirability (multiple happy users, curated setting, high-status environment)",
  scarcity:
    "visual cues of exclusivity — limited quantity feel, premium packaging, spotlight on a single unit",
  curiosity:
    "intriguing angle or macro detail that provokes 'what is this?', product partially revealed, high visual curiosity gap",
  aspiration:
    "elevated aspirational lifestyle, subject appearing successful and confident, high-status environment",
};

const CONVERSION_LAWS = [
  "Composition follows the AIDA principle: 1 clear focal point, strong contrast, obvious hero, effortless scan path.",
  "Thumb-stopping hero: subject occupies 55–75% of frame, unambiguous silhouette against the background.",
  "Colour theory: use brand colours as accent + complementary contrast so the product pops off-scroll.",
  "Lighting: directional key light + subtle rim to sculpt the product; avoid flat, muddy or overexposed frames.",
  "Depth: shallow depth-of-field with the product tack-sharp; background softly blurred to isolate the hero.",
  "Space for copy: leave a clean, uncluttered zone where a headline / CTA could sit if overlaid later.",
  "Photorealism: commercial-grade advertising realism, no plasticky CGI, no uncanny faces, hands with correct anatomy.",
  "Absolutely no text, watermarks, logos, UI overlays, captions or price tags rendered in the image.",
];

export function buildImagePrompt(input: {
  style: ImageStyle;
  format: ImageFormat;
  scene?: SceneMode;
  people?: PeoplePreset;
  hook?: ConversionHook;
  brand: BrandDna;
  product: ProductCtx;
  notes?: string;
}): string {
  const parts: string[] = [];
  parts.push("HIGH-CONVERSION advertising photograph, engineered to stop the scroll and drive click-through.");
  parts.push(STYLE_DIRECTIVES[input.style]);
  parts.push(FORMAT_DIRECTIVES[input.format]);
  if (input.scene) parts.push(`Scene: ${SCENE_DIRECTIVES[input.scene]}.`);
  if (input.people && input.people !== "none") parts.push(`People: ${PEOPLE_DIRECTIVES[input.people]}.`);
  else parts.push(PEOPLE_DIRECTIVES.none + ".");
  if (input.hook && input.hook !== "none") parts.push(`Conversion angle: ${HOOK_DIRECTIVES[input.hook]}.`);

  if (input.product?.name) {
    parts.push(
      `Featured product: "${input.product.name}"${input.product.category ? ` (${input.product.category})` : ""} — the product is the undeniable visual hero, label perfectly legible, packaging accurate.`,
    );
  }
  const colors = input.product?.brand_colors?.length ? input.product.brand_colors : input.brand?.colors;
  if (colors && colors.length) parts.push(`Brand palette (use as accents / mood): ${colors.join(", ")}.`);
  if (input.brand?.brand_name) parts.push(`Brand: ${input.brand.brand_name}.`);
  if (input.brand?.tone) parts.push(`Brand tone: ${input.brand.tone}.`);
  if (input.brand?.audience) parts.push(`Target buyer persona: ${input.brand.audience}.`);
  if (input.brand?.description) parts.push(`Brand context: ${input.brand.description}.`);
  if (input.product?.notes) parts.push(`Product notes: ${input.product.notes}.`);
  if (input.notes) parts.push(`Additional creative direction: ${input.notes}.`);

  parts.push(CONVERSION_LAWS.join(" "));
  parts.push(
    "Ultra-realistic, tack-sharp, commercial-grade advertising photograph, DSLR full-frame look, 50mm f/1.8, natural product materials.",
  );
  return parts.join(" ");
}

// ============ VIDEO ============

const VIDEO_STYLE_DIRECTIVES: Partial<Record<VideoStyle, string>> = {
  luxo: "opulent cinematic luxury, marble and gold accents, slow camera glides",
  apple: "clean Apple-style product film, seamless backdrop, precision motion, macro reveal",
  premium: "premium cinematic mood, rich shadows, elegant transitions",
  minimalista: "minimalist compositions, generous negative space, calm pacing",
  cinematografico: "wide anamorphic cinematography, dramatic lighting, filmic color grade",
  ugc: "authentic hand-held UGC feel, direct-to-camera intimacy, natural light, phone-native energy",
  tecnologia: "high-tech scene, neon rim light, HUD reveals, precise robotic motion",
  moda: "high-fashion editorial, styled movement, dramatic contrast",
  beauty: "beauty campaign, macro skin/product details, dewy highlights",
  fitness: "dynamic sport energy, sweat highlights, kinetic camera",
  dark_luxury: "dark luxury, deep charcoal, warm gold accents, slow reveals",
};

export function buildVideoPrompt(input: {
  style: VideoStyle;
  format: VideoFormat;
  duration: number;
  objective: string;
  people?: PeoplePreset;
  hook?: ConversionHook;
  brand: BrandDna;
  product: ProductCtx;
}): string {
  const parts: string[] = [];
  parts.push(
    `${input.duration}-second HIGH-CONVERSION ${input.format} ad video, engineered as a scroll-stopping performance creative (Meta / TikTok / YouTube Shorts).`,
  );
  parts.push(
    `Style: ${VIDEO_STYLE_DIRECTIVES[input.style] ?? input.style}. Cinematic camera moves, elegant transitions, premium lighting, 4k, filmic color grade.`,
  );
  parts.push(`Native aspect for ${input.format}.`);
  parts.push(`Objective: ${input.objective}.`);
  if (input.people && input.people !== "none") parts.push(`Cast: ${PEOPLE_DIRECTIVES[input.people]}.`);
  else parts.push("No people on screen — product is the sole hero.");
  if (input.hook && input.hook !== "none") parts.push(`Hook angle: ${HOOK_DIRECTIVES[input.hook]}.`);
  if (input.product?.name) parts.push(`Hero product: ${input.product.name} — visible, legible label, kept as the visual anchor throughout.`);
  if (input.brand?.brand_name) parts.push(`Brand: ${input.brand.brand_name}.`);
  if (input.brand?.tone) parts.push(`Tone: ${input.brand.tone}.`);
  if (input.brand?.audience) parts.push(`Target buyer: ${input.brand.audience}.`);

  parts.push(
    "Storyboard (high-conversion ad structure): (1) 0–1.5s HOOK — a striking, thumb-stopping opening frame that instantly creates curiosity or shows the product benefit; (2) mid — desire beat: macro detail, texture, in-context beauty shot; (3) proof / lifestyle moment; (4) closing 1s — clean brand / product hero moment ready for a CTA overlay.",
  );
  parts.push(
    "Editing: fast motivated cuts, dynamic camera, subtle speed-ramps, seamless transitions, no dead frames.",
  );
  return parts.join(" ");
}
