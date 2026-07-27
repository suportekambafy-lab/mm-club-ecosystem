/**
 * MM Studio Live — definições de filtros de imagem e voz.
 *
 * Estado global simples (persistido em localStorage) para que o painel de
 * controlo, o processador de vídeo e o de áudio partilhem a mesma configuração.
 */

export interface StudioSettings {
  /** Filtros de imagem ligados/desligados. */
  videoEnabled: boolean;
  /** 0.5 – 1.8 */
  brightness: number;
  /** 0.5 – 1.8 */
  contrast: number;
  /** 0 – 2 */
  saturation: number;
  /** -30 – 30 (graus de rotação de matiz: negativo = frio, positivo = quente) */
  warmth: number;
  /** 0 – 1 — suavização de pele (soft focus) */
  softness: number;
  /** 0 – 1 — vinheta cinematográfica */
  vignette: number;

  /** Melhoramento de voz ligado/desligado. */
  audioEnabled: boolean;
  /** 0 – 1 — agressividade do gate de redução de ruído */
  noiseReduction: number;
  /** 0 – 1 — compressor / nivelamento de voz */
  voiceLeveling: number;
  /** 0 – 1 — corte de graves (rumble/ar condicionado) + presença */
  voiceClarity: number;
}

export const STUDIO_PRESETS = {
  natural: {
    brightness: 1,
    contrast: 1,
    saturation: 1,
    warmth: 0,
    softness: 0,
    vignette: 0,
  },
  studio: {
    brightness: 1.12,
    contrast: 1.08,
    saturation: 1.05,
    warmth: 6,
    softness: 0.35,
    vignette: 0.2,
  },
  cinema: {
    brightness: 0.98,
    contrast: 1.22,
    saturation: 0.9,
    warmth: -4,
    softness: 0.15,
    vignette: 0.45,
  },
  glow: {
    brightness: 1.2,
    contrast: 1,
    saturation: 1.15,
    warmth: 10,
    softness: 0.6,
    vignette: 0.1,
  },
} as const;

export type StudioPresetName = keyof typeof STUDIO_PRESETS;

export const DEFAULT_STUDIO_SETTINGS: StudioSettings = {
  videoEnabled: false,
  ...STUDIO_PRESETS.studio,
  audioEnabled: true,
  noiseReduction: 0.45,
  voiceLeveling: 0.6,
  voiceClarity: 0.5,
};

const KEY = "mmclub.studio.filters.v1";

let current: StudioSettings = { ...DEFAULT_STUDIO_SETTINGS };
let loaded = false;
const listeners = new Set<(s: StudioSettings) => void>();

function load(): StudioSettings {
  if (loaded || typeof window === "undefined") return current;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) current = { ...DEFAULT_STUDIO_SETTINGS, ...(JSON.parse(raw) as Partial<StudioSettings>) };
  } catch {
    /* ignore */
  }
  return current;
}

export function getStudioSettings(): StudioSettings {
  return load();
}

export function setStudioSettings(patch: Partial<StudioSettings>) {
  current = { ...load(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(current));
}

export function subscribeStudio(fn: (s: StudioSettings) => void): () => void {
  load();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** String CSS para canvas/preview a partir das definições de imagem. */
export function studioCssFilter(s: StudioSettings): string {
  if (!s.videoEnabled) return "none";
  const parts = [
    `brightness(${s.brightness})`,
    `contrast(${s.contrast})`,
    `saturate(${s.saturation})`,
  ];
  if (s.warmth) parts.push(`sepia(${Math.min(0.35, Math.abs(s.warmth) / 60)}) hue-rotate(${s.warmth > 0 ? 0 : -20}deg)`);
  return parts.join(" ");
}
