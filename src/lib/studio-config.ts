// MM Studio — configuração partilhada entre server e client.

export const STUDIO_COSTS = {
  imageBatch: 160, // 4 imagens por batch (40 cada)
  imageSingle: 40,
  video: 250,
} as const;

export type ImageStyle =
  | "luxo"
  | "minimalista"
  | "apple"
  | "premium"
  | "tecnologia"
  | "moda"
  | "beleza"
  | "comida"
  | "fitness"
  | "elegante"
  | "escuro"
  | "claro"
  | "lifestyle"
  | "estudio";

export const IMAGE_STYLES: { id: ImageStyle; label: string; hint: string }[] = [
  { id: "luxo", label: "Luxo", hint: "Ouro, mármore, iluminação editorial" },
  { id: "minimalista", label: "Minimalista", hint: "Espaço negativo, cores neutras" },
  { id: "apple", label: "Apple", hint: "Fundo branco/preto, sombra suave" },
  { id: "premium", label: "Premium", hint: "Textura rica, profundidade cinematográfica" },
  { id: "tecnologia", label: "Tecnologia", hint: "Néon, superfícies escuras, HUD" },
  { id: "moda", label: "Moda", hint: "Editorial de revista, contraste alto" },
  { id: "beleza", label: "Beleza", hint: "Pele, tons pastel, macro" },
  { id: "comida", label: "Comida", hint: "Vapor, luz lateral, apetitoso" },
  { id: "fitness", label: "Fitness", hint: "Dinâmico, transpiração, energia" },
  { id: "elegante", label: "Elegante", hint: "Sereno, sofisticado, atemporal" },
  { id: "escuro", label: "Dark", hint: "Fundo profundo, dourados quentes" },
  { id: "claro", label: "Light", hint: "Alta chave, arejado, luminoso" },
  { id: "lifestyle", label: "Lifestyle", hint: "Ambiente real, contexto humano" },
  { id: "estudio", label: "Estúdio", hint: "Softbox, ciclorama, produto puro" },
];

export type ImageFormat =
  | "ig_feed"
  | "ig_story"
  | "ig_reels_cover"
  | "facebook"
  | "tiktok"
  | "loja"
  | "banner"
  | "thumbnail";

export const IMAGE_FORMATS: {
  id: ImageFormat;
  label: string;
  aspect: string;
  size: "1024x1024" | "1024x1536" | "1536x1024";
}[] = [
  { id: "ig_feed", label: "Instagram Feed", aspect: "1:1", size: "1024x1024" },
  { id: "ig_story", label: "Instagram Story", aspect: "9:16", size: "1024x1536" },
  { id: "ig_reels_cover", label: "Reels Cover", aspect: "9:16", size: "1024x1536" },
  { id: "facebook", label: "Facebook", aspect: "1:1", size: "1024x1024" },
  { id: "tiktok", label: "TikTok", aspect: "9:16", size: "1024x1536" },
  { id: "loja", label: "Loja Online", aspect: "1:1", size: "1024x1024" },
  { id: "banner", label: "Banner", aspect: "16:9", size: "1536x1024" },
  { id: "thumbnail", label: "Thumbnail", aspect: "16:9", size: "1536x1024" },
];

export type VideoStyle =
  | "luxo"
  | "apple"
  | "premium"
  | "minimalista"
  | "cinematografico"
  | "ugc"
  | "tecnologia"
  | "moda"
  | "beauty"
  | "fitness"
  | "dark_luxury";

export const VIDEO_STYLES: { id: VideoStyle; label: string }[] = [
  { id: "luxo", label: "Luxo" },
  { id: "apple", label: "Apple" },
  { id: "premium", label: "Premium" },
  { id: "minimalista", label: "Minimalista" },
  { id: "cinematografico", label: "Cinematográfico" },
  { id: "ugc", label: "UGC" },
  { id: "tecnologia", label: "Tecnologia" },
  { id: "moda", label: "Moda" },
  { id: "beauty", label: "Beauty" },
  { id: "fitness", label: "Fitness" },
  { id: "dark_luxury", label: "Dark Luxury" },
];

export type VideoFormat = "reels" | "tiktok" | "facebook" | "stories" | "shorts";
export const VIDEO_FORMATS: { id: VideoFormat; label: string; aspect: "9:16" | "1:1" | "16:9" }[] = [
  { id: "reels", label: "Instagram Reels", aspect: "9:16" },
  { id: "tiktok", label: "TikTok", aspect: "9:16" },
  { id: "facebook", label: "Facebook", aspect: "1:1" },
  { id: "stories", label: "Stories", aspect: "9:16" },
  { id: "shorts", label: "YouTube Shorts", aspect: "9:16" },
];

export const VIDEO_DURATIONS = [8, 10] as const;

export const VIDEO_OBJECTIVES: { id: string; label: string }[] = [
  { id: "showcase", label: "Mostrar produto" },
  { id: "usage", label: "Produto em utilização" },
  { id: "presentation", label: "Apresentação premium" },
  { id: "ad", label: "Vídeo publicitário" },
  { id: "unboxing", label: "Unboxing" },
  { id: "lifestyle", label: "Lifestyle" },
];
