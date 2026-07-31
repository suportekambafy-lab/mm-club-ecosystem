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
    `Professional vector-style brand logo design for "${name}".`,
    style ? `Design direction: ${style.prompt}.` : "",
    layout ? `Composition: ${layout.prompt}.` : "",
    input.layout === "icone"
      ? "Absolutely no text, no letters, no words anywhere in the image."
      : `The only text allowed is the exact brand name "${name}" spelled perfectly, correct letters, no misspelling, no extra words.`,
    input.tagline && input.layout !== "icone"
      ? `Optionally a small tagline underneath reading exactly "${input.tagline}", set much smaller and lighter.`
      : "",
    input.industry ? `Industry context: ${input.industry}.` : "",
    paletteDirective(input.palette, input.colors ?? []),
    bg ? `Presentation: single centered logo ${bg.prompt}, generous margins around the mark.` : "",
    "Flat 2D vector aesthetic, crisp clean edges, perfectly scalable, print-ready identity design by a top branding studio.",
    "Do NOT include: mockups, business cards, photographs, 3D renders, bevels, drop shadows, glossy reflections, watermarks, grids of multiple logos, UI frames, or lorem text.",
    "Only ONE single logo in the frame.",
    input.notes ? `Additional direction: ${input.notes}` : "",
  ];

  return parts.filter(Boolean).join(" ");
}
