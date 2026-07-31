// MM Studio — Gerador de logotipos (config partilhada server/client).
import { STUDIO_COSTS } from "./studio-config";

export const LOGO_VARIANTS = 3;
export const LOGO_COST_PER_VARIANT = STUDIO_COSTS.imageSingle;
export const LOGO_BATCH_COST = LOGO_VARIANTS * LOGO_COST_PER_VARIANT;

export type LogoStyle =
  | "monograma"
  | "wordmark"
  | "emblema"
  | "minimalista"
  | "luxo"
  | "geometrico"
  | "organico"
  | "tech"
  | "vintage"
  | "mascote";

export const LOGO_STYLES: { id: LogoStyle; label: string; hint: string; prompt: string }[] = [
  { id: "monograma", label: "Monograma", hint: "Iniciais construídas com precisão", prompt: "a refined monogram lettermark built from the brand initials, custom geometry, perfectly balanced counters" },
  { id: "wordmark", label: "Wordmark", hint: "Só tipografia, muito bem desenhada", prompt: "a pure typographic wordmark with custom letterforms, immaculate kerning and optical balance" },
  { id: "emblema", label: "Emblema", hint: "Selo / crista contida", prompt: "a contained emblem/badge lockup, crest-like silhouette, symmetrical and authoritative" },
  { id: "minimalista", label: "Minimalista", hint: "Traço essencial, espaço negativo", prompt: "an ultra-minimal mark built from the fewest possible strokes, clever negative space" },
  { id: "luxo", label: "Luxo", hint: "Serifa fina, ouro discreto", prompt: "a luxury fashion-house mark, high-contrast thin serif, restrained metallic accent, couture elegance" },
  { id: "geometrico", label: "Geométrico", hint: "Grelha, círculos, ângulos exatos", prompt: "a strictly geometric mark constructed on a visible grid of circles and exact angles" },
  { id: "organico", label: "Orgânico", hint: "Curvas suaves, natural", prompt: "an organic mark with soft flowing curves, natural and human, hand-refined bezier curves" },
  { id: "tech", label: "Tech", hint: "Moderno, digital, nítido", prompt: "a modern technology mark, crisp digital geometry, confident and scalable at icon size" },
  { id: "vintage", label: "Vintage", hint: "Artesanal, retro premium", prompt: "a vintage heritage mark, retro craft aesthetic, letterpress feeling, timeless" },
  { id: "mascote", label: "Mascote", hint: "Símbolo/ícone com carácter", prompt: "a simplified iconic mascot symbol, flat vector character reduced to essential shapes" },
];

export type LogoLayout = "icone" | "horizontal" | "vertical";
export const LOGO_LAYOUTS: { id: LogoLayout; label: string; hint: string; prompt: string }[] = [
  { id: "icone", label: "Só ícone", hint: "Símbolo isolado", prompt: "isolated symbol only, no text, centered" },
  { id: "horizontal", label: "Horizontal", hint: "Ícone + nome ao lado", prompt: "horizontal lockup: symbol on the left, brand name set beside it, optically aligned" },
  { id: "vertical", label: "Vertical", hint: "Ícone acima do nome", prompt: "vertical stacked lockup: symbol above, brand name centered underneath" },
];

export type LogoBackground = "branco" | "preto" | "transparente";
export const LOGO_BACKGROUNDS: { id: LogoBackground; label: string; prompt: string }[] = [
  { id: "branco", label: "Fundo branco", prompt: "on a pure flat white background (#FFFFFF), no shadow, no gradient, no mockup" },
  { id: "preto", label: "Fundo preto", prompt: "on a pure flat black background (#000000), no shadow, no gradient, no mockup" },
  { id: "transparente", label: "Fundo neutro claro", prompt: "on a flat neutral very light grey background, no shadow, no gradient, no mockup" },
];

export type LogoPalette = "marca" | "mono_preto" | "mono_branco" | "ouro" | "livre";
export const LOGO_PALETTES: { id: LogoPalette; label: string }[] = [
  { id: "marca", label: "Cores da marca" },
  { id: "mono_preto", label: "Monocromático preto" },
  { id: "mono_branco", label: "Monocromático branco" },
  { id: "ouro", label: "Ouro / champanhe" },
  { id: "livre", label: "A IA decide" },
];

export type LogoInput = {
  brandName: string;
  tagline?: string;
  industry?: string;
  style: LogoStyle;
  layout: LogoLayout;
  background: LogoBackground;
  palette: LogoPalette;
  colors?: string[];
  notes?: string;
};

function paletteDirective(p: LogoPalette, colors: string[]): string {
  switch (p) {
    case "marca":
      return colors.length > 0
        ? `Use strictly this brand palette: ${colors.join(", ")}. No other colours.`
        : "Use a single confident brand colour plus neutral.";
    case "mono_preto":
      return "Strictly monochrome: solid black mark, nothing else.";
    case "mono_branco":
      return "Strictly monochrome: solid white mark, nothing else.";
    case "ouro":
      return "Palette limited to warm gold / champagne tones with a deep neutral.";
    case "livre":
      return "Choose one restrained, sophisticated palette of at most two colours.";
  }
}

/** Constrói o prompt final para o modelo de imagem. */
export function buildLogoPrompt(input: LogoInput): string {
  const style = LOGO_STYLES.find((s) => s.id === input.style);
  const layout = LOGO_LAYOUTS.find((l) => l.id === input.layout);
  const bg = LOGO_BACKGROUNDS.find((b) => b.id === input.background);
  const name = input.brandName.trim();

  const parts = [
    `Master-level brand identity logo design for "${name}", of the craft quality produced by world-class identity studios (Pentagram, Chermayeff & Geismar, Collins, Base Design) — the level of restraint and precision seen in the marks of the world's most valuable technology, payments and fashion brands.`,
    style ? `Design direction: ${style.prompt}.` : "",
    layout ? `Composition: ${layout.prompt}.` : "",
    input.layout === "icone"
      ? "Absolutely no text, no letters, no words anywhere in the image."
      : `The only text allowed is the exact brand name "${name}" spelled perfectly, correct letters, no misspelling, no extra words, no duplicated name.`,
    input.tagline && input.layout !== "icone"
      ? `Optionally a small tagline underneath reading exactly "${input.tagline}", set much smaller and lighter.`
      : "",
    input.industry ? `Industry context: ${input.industry}.` : "",
    paletteDirective(input.palette, input.colors ?? []),
    // Craft rules — o que separa um logo amador de um logo de marca real.
    "Construction rules: built on a strict geometric grid with mathematically consistent stroke weights, optical corrections and even visual mass; a single clear idea reduced to its simplest possible form; instantly recognisable as a silhouette; legible and balanced at 16px favicon size as well as on a building.",
    "Typography rules: use one impeccable typeface only (grotesk, neo-grotesk or high-craft serif), with tightly optically-corrected kerning, consistent x-height, and no default system fonts, no faux bold, no letter-spacing artefacts, no distortion or stretching.",
    bg ? `Presentation: one single centered logo lockup ${bg.prompt}, generous even margins around the mark, nothing else in the frame.` : "",
    "Pure flat 2D vector aesthetic: solid fills, razor-sharp edges, infinitely scalable, print- and screen-ready identity artwork.",
    "STRICTLY AVOID (these mark it as amateur): clip-art, generic swooshes, globes, lightbulbs, gradients meshes, rainbow colours, more than two colours, 3D renders, bevels, embossing, drop shadows, glossy reflections, sparkles, AI-looking flourishes, decorative frames, stock icon libraries, mockups, business cards, photographs, watermarks, grids of multiple logo options, UI frames, placeholder or lorem text, spelling errors, extra random letters.",
    "Exactly ONE final logo in the frame — a finished, client-ready deliverable.",
    input.notes ? `Additional direction: ${input.notes}` : "",
  ];

  return parts.filter(Boolean).join(" ");
}

// ============ APLICAÇÕES / MOCKUPS SOBRE O LOGO ============
export const LOGO_APPLICATION_COST = STUDIO_COSTS.imageSingle;

export type LogoApplicationId =
  | "cartao"
  | "papelaria"
  | "sinalizacao"
  | "vitrine"
  | "embalagem"
  | "tshirt"
  | "tote"
  | "app_icon"
  | "website"
  | "instagram"
  | "banner_ads"
  | "outdoor";

export const LOGO_APPLICATIONS: {
  id: LogoApplicationId;
  label: string;
  hint: string;
  size: "1024x1024" | "1536x1024" | "1024x1536";
  prompt: string;
}[] = [
  { id: "cartao", label: "Cartão de visita", hint: "Par de cartões premium", size: "1536x1024", prompt: "a premium business card mockup: two thick uncoated cards, one face-up showing the logo, one back showing a subtle detail, photographed top-down on a refined neutral surface, soft directional daylight, shallow depth of field" },
  { id: "papelaria", label: "Papelaria", hint: "Estacionário completo", size: "1536x1024", prompt: "a full stationery flat-lay: letterhead, envelope, business card and folder, arranged with editorial precision, top-down, soft daylight, premium paper texture" },
  { id: "sinalizacao", label: "Fachada / sinalética", hint: "Letras na fachada", size: "1536x1024", prompt: "the logo as brushed-metal or acrylic dimensional signage on an architectural facade wall, realistic depth and contact shadow, late-afternoon light, minimal architecture" },
  { id: "vitrine", label: "Vitrine / loja", hint: "Retalho premium", size: "1536x1024", prompt: "the logo applied to a premium retail storefront window in a design-forward flagship store, evening reflections, cinematic and aspirational" },
  { id: "embalagem", label: "Embalagem", hint: "Caixa + saco", size: "1536x1024", prompt: "premium packaging mockup: a rigid box and a matte shopping bag carrying the logo, studio lighting, soft shadows, luxury unboxing feeling" },
  { id: "tshirt", label: "T-shirt", hint: "Merch vestido", size: "1024x1024", prompt: "the logo printed small and tastefully on a heavyweight cotton t-shirt, apparel product photography, clean neutral studio background, realistic fabric texture" },
  { id: "tote", label: "Tote bag", hint: "Merch têxtil", size: "1024x1024", prompt: "the logo screen-printed on a natural canvas tote bag, studio product photography, soft shadow, realistic weave texture" },
  { id: "app_icon", label: "Ícone de app", hint: "Ícone quadrado", size: "1024x1024", prompt: "the logo mark centred as a flat rounded-square app icon: solid brand-colour background, the mark perfectly optically centred with generous padding, crisp flat vector rendering, filling the whole frame. No phone, no device, no hand, no home screen, no other icons, no photography" },
  { id: "website", label: "Banner de site (hero)", hint: "Banner grande, sem PC", size: "1536x1024", prompt: "a large full-bleed website hero BANNER artwork (flat graphic design, edge to edge, filling the entire frame): the logo placed with confident scale in the composition, a wide premium brand background using the brand colours, room for one short headline, editorial layout and generous negative space. Absolutely NO laptop, NO monitor, NO phone, NO device, NO desk, NO workspace photo, NO browser window or UI chrome, NO mockup framing — this is the flat banner artwork itself" },
  { id: "instagram", label: "Instagram", hint: "Grelha de perfil", size: "1024x1024", prompt: "a flat social media brand kit board: profile avatar with the logo plus a coherent 3-post grid using the brand colours and typography, flat clean graphic layout, no phone, no device, no photography of screens" },
  { id: "banner_ads", label: "Banner publicitário", hint: "Anúncio horizontal", size: "1536x1024", prompt: "a polished flat horizontal advertising banner artwork filling the whole frame, using the logo with strong composition and room for a short headline, premium brand-campaign art direction. No device, no mockup frame, no browser chrome" },
  { id: "outdoor", label: "Outdoor", hint: "Billboard urbano", size: "1536x1024", prompt: "the logo on a large urban billboard, photographed from street level at dusk, cinematic and confident brand campaign feeling" },

];

/** Prompt para aplicar um logotipo existente num mockup/banner (image edit com o logo como referência). */
export function buildLogoApplicationPrompt(opts: {
  application: LogoApplicationId;
  brandName: string;
  colors?: string[];
  notes?: string;
}): string {
  const app = LOGO_APPLICATIONS.find((a) => a.id === opts.application);
  const name = opts.brandName.trim();
  const colors = (opts.colors ?? []).filter(Boolean).slice(0, 4);

  // Formatos que são artwork plano (não cenas fotografadas nem mockups em dispositivos).
  const FLAT: LogoApplicationId[] = ["website", "banner_ads", "instagram", "app_icon"];
  const isFlat = FLAT.includes(opts.application);

  return [
    isFlat ? `Flat brand artwork for "${name}".` : `Brand application mockup for "${name}".`,
    "The attached reference image is the brand's FINAL logo. Reproduce it exactly as it is — identical shapes, proportions, letterforms, spelling and colours. Do not redraw, restyle, recolour, crop, mirror or add elements to the logo.",
    app ? `Create ${app.prompt}.` : "",
    colors.length > 0 ? `Supporting palette: ${colors.join(", ")}.` : "Supporting palette: refined neutrals with one accent taken from the logo.",
    isFlat
      ? "Art direction: flat 2D graphic design of art-director quality, edge-to-edge composition that fills the entire frame, crisp vector rendering, refined type hierarchy, generous negative space. No photorealistic props, no device mockups, no perspective frames, no shadows simulating physical objects."
      : "Art direction: high-end brand presentation board quality, photorealistic materials, believable lighting and contact shadows, editorial composition, generous negative space.",
    "No text other than the brand name inside the logo (and, where the composition naturally requires it, one short realistic headline). No lorem ipsum, no watermarks, no multiple competing logos, no distorted or misspelled lettering, no collage of many mockups — one single hero scene.",
    opts.notes ? `Additional direction: ${opts.notes}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}


