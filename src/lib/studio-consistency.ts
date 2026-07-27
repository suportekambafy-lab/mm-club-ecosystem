// MM Studio — "Consistency Lock": bíblia determinística de personagem/cena
// reutilizada em TODOS os segmentos e imagens de uma geração.
import type { ConversionHook, PeoplePreset } from "./studio-config";

export type ConsistencyLock = {
  /** Identidade da personagem (vazio quando não há pessoas). */
  character?: {
    ethnicity?: string;
    skin_tone?: string;
    eye_color?: string;
    hair?: string;
    apparent_age?: string;
    build?: string;
    makeup?: string;
    nails?: string;
    tattoos?: string;
    accessories?: string;
    wardrobe?: string;
    footwear?: string;
  };
  scene?: {
    environment?: string;
    time_of_day?: string;
    light_direction?: string;
    light_temperature?: string;
    palette?: string;
    lens?: string;
  };
  product?: {
    description?: string;
  };
};

export const ANTI_BUG_RULES: string[] = [
  "ZERO identity drift: the same face, bone structure, apparent age, body proportions and skin tone in every single frame and every segment.",
  "ZERO wardrobe drift: identical clothing items, exact same colours, fabrics, footwear and fit throughout.",
  "ZERO detail drift: nail polish colour, makeup, tattoos, earrings, rings, watches and glasses stay pixel-consistent from first to last frame.",
  "ZERO object popping: nothing appears, disappears, teleports or changes position between frames without a visible, motivated movement.",
  "Anatomy: exactly five fingers per hand, correct joints, no fused or extra limbs, no warped faces, no melting edges.",
  "No illegible, garbled or invented text anywhere in the frame; any on-screen text must be intentional, correctly spelled and fully readable.",
  "Motion must be physically plausible: smooth, motivated camera moves, no jitter, no abrupt jump cuts, no sudden reframing or focal-length jumps.",
  "Lighting continuity: same key direction, same colour temperature, same shadow behaviour across the whole piece.",
  "No flicker, no morphing background, no warped straight lines, no duplicated subjects, no compression artefacts.",
];

/** Descreve o lock como texto estável para prompt. */
export function renderConsistencyLock(lock: ConsistencyLock | null | undefined): string {
  if (!lock) return "";
  const lines: string[] = [];
  const c = lock.character;
  if (c && Object.values(c).some(Boolean)) {
    const bits = [
      c.ethnicity && `ethnicity: ${c.ethnicity}`,
      c.skin_tone && `skin tone: ${c.skin_tone}`,
      c.eye_color && `eyes: ${c.eye_color}`,
      c.hair && `hair: ${c.hair}`,
      c.apparent_age && `apparent age: ${c.apparent_age}`,
      c.build && `build: ${c.build}`,
      c.makeup && `makeup: ${c.makeup}`,
      c.nails && `nails: ${c.nails}`,
      c.tattoos && `tattoos/body marks: ${c.tattoos}`,
      c.accessories && `accessories: ${c.accessories}`,
      c.wardrobe && `wardrobe: ${c.wardrobe}`,
      c.footwear && `footwear: ${c.footwear}`,
    ].filter(Boolean);
    if (bits.length) lines.push(`LOCKED CHARACTER (identical in every frame) — ${bits.join("; ")}.`);
  }
  const s = lock.scene;
  if (s && Object.values(s).some(Boolean)) {
    const bits = [
      s.environment && `environment: ${s.environment}`,
      s.time_of_day && `time of day: ${s.time_of_day}`,
      s.light_direction && `key light: ${s.light_direction}`,
      s.light_temperature && `colour temperature: ${s.light_temperature}`,
      s.palette && `palette: ${s.palette}`,
      s.lens && `lens/DOF: ${s.lens}`,
    ].filter(Boolean);
    if (bits.length) lines.push(`LOCKED SCENE (identical in every frame) — ${bits.join("; ")}.`);
  }
  if (lock.product?.description) {
    lines.push(`LOCKED PRODUCT — ${lock.product.description}. Same shape, colours, label and proportions every frame.`);
  }
  return lines.join(" ");
}

export function consistencyBlock(lock: ConsistencyLock | null | undefined): string {
  const rendered = renderConsistencyLock(lock);
  return [
    "=== CONSISTENCY LOCK (must never change) ===",
    rendered,
    ANTI_BUG_RULES.join(" "),
  ]
    .filter(Boolean)
    .join(" ");
}

export type ContinuityStrategy = "sequential" | "parallel";

const CONTINUITY_OBJECTIVES = new Set(["usage", "unboxing", "lifestyle", "ad"]);
const NARRATIVE_HOOKS = new Set<ConversionHook>(["before_after", "problem_solution", "curiosity"]);

/**
 * Decide automaticamente se os segmentos devem ser encadeados (continuidade
 * essencial) ou gerados em paralelo (cenas independentes / produto isolado).
 */
export function pickContinuityStrategy(input: {
  people: PeoplePreset;
  objective?: string | null;
  hook?: ConversionHook | null;
  force?: boolean;
  segments: number;
}): { strategy: ContinuityStrategy; reason: string } {
  if (input.segments <= 1) return { strategy: "parallel", reason: "Segmento único." };
  if (input.force) return { strategy: "sequential", reason: "Máxima consistência activada pelo utilizador." };
  if (input.people && input.people !== "none") {
    return { strategy: "sequential", reason: "Há pessoas em cena — continuidade de identidade é essencial." };
  }
  if (input.objective && CONTINUITY_OBJECTIVES.has(input.objective)) {
    return { strategy: "sequential", reason: "Objetivo narrativo — as cenas estão ligadas." };
  }
  if (input.hook && NARRATIVE_HOOKS.has(input.hook)) {
    return { strategy: "sequential", reason: "Ângulo narrativo — a história precisa de continuidade." };
  }
  return { strategy: "parallel", reason: "Cenas independentes de produto — geração paralela mais rápida." };
}
