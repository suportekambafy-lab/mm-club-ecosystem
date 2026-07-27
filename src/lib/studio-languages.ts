// MM Studio — idiomas separados por variante regional (pt-PT ≠ pt-BR).

export type StudioLocale =
  | "pt-PT"
  | "pt-BR"
  | "en-US"
  | "en-GB"
  | "es-ES"
  | "es-419"
  | "fr-FR"
  | "it-IT"
  | "de-DE";

export type LocaleDef = {
  id: StudioLocale;
  label: string;
  short: string;
  /** Instrução linguística injectada no prompt. */
  directive: string;
};

export const STUDIO_LOCALES: LocaleDef[] = [
  {
    id: "pt-PT",
    label: "Português (Portugal)",
    short: "PT-PT",
    directive:
      "European Portuguese from Portugal (pt-PT) ONLY — Lisbon accent, European vocabulary and grammar (tu/vós forms, 'telemóvel', 'casa de banho', 'está a fazer' gerund-free construction, 'ecrã', 'autocarro'). Never Brazilian Portuguese: no 'você' as default, no 'celular', no 'banheiro', no '-ndo' gerund ('está fazendo'), no Brazilian accent or intonation.",
  },
  {
    id: "pt-BR",
    label: "Português (Brasil)",
    short: "PT-BR",
    directive:
      "Brazilian Portuguese (pt-BR) ONLY — São Paulo/Rio neutral accent, Brazilian vocabulary ('você', 'celular', 'está fazendo'). Never European Portuguese vocabulary or accent.",
  },
  { id: "en-US", label: "English (US)", short: "EN-US", directive: "American English (en-US), neutral US accent and US spelling." },
  { id: "en-GB", label: "English (UK)", short: "EN-GB", directive: "British English (en-GB), RP accent and UK spelling." },
  { id: "es-ES", label: "Español (España)", short: "ES-ES", directive: "European Spanish from Spain (es-ES), Castilian accent, 'vosotros' forms allowed." },
  { id: "es-419", label: "Español (LATAM)", short: "ES-419", directive: "Latin American Spanish (es-419), neutral LATAM accent, no Castilian 'vosotros' or 'ceceo'." },
  { id: "fr-FR", label: "Français", short: "FR", directive: "Metropolitan French (fr-FR), neutral Parisian accent." },
  { id: "it-IT", label: "Italiano", short: "IT", directive: "Standard Italian (it-IT), neutral accent." },
  { id: "de-DE", label: "Deutsch", short: "DE", directive: "Standard High German (de-DE), neutral accent." },
];

export const STUDIO_LOCALE_IDS = STUDIO_LOCALES.map((l) => l.id) as [StudioLocale, ...StudioLocale[]];

export type VoiceGender = "female" | "male" | "neutral";

export const VOICE_GENDERS: { id: VoiceGender; label: string; directive: string }[] = [
  { id: "female", label: "Voz feminina", directive: "warm, confident female voice-over (late 20s–30s)" },
  { id: "male", label: "Voz masculina", directive: "confident, grounded male voice-over (late 20s–30s)" },
  { id: "neutral", label: "Neutra premium", directive: "neutral premium announcer voice-over" },
];

/** Mapeia valores antigos (`pt`, `male_pt`, `en`…) para o novo modelo de locale. */
export function normalizeLegacyLocale(value?: string | null): StudioLocale | null {
  if (!value || value === "none") return null;
  const v = value.toLowerCase();
  if (STUDIO_LOCALES.some((l) => l.id.toLowerCase() === v)) return value as StudioLocale;
  if (v.includes("pt_br") || v.includes("pt-br")) return "pt-BR";
  if (v.includes("pt")) return "pt-PT";
  if (v.includes("es")) return "es-ES";
  if (v.includes("en")) return "en-US";
  if (v.includes("fr")) return "fr-FR";
  if (v.includes("it")) return "it-IT";
  if (v.includes("de")) return "de-DE";
  return null;
}

export function normalizeLegacyVoice(value?: string | null): VoiceGender | null {
  if (!value || value === "none") return null;
  if (value.startsWith("male")) return "male";
  if (value.startsWith("female")) return "female";
  return "neutral";
}

export function localeDirective(id: StudioLocale): string {
  return STUDIO_LOCALES.find((l) => l.id === id)?.directive ?? "Neutral international English.";
}

export function localeLabel(id: StudioLocale): string {
  return STUDIO_LOCALES.find((l) => l.id === id)?.label ?? id;
}
