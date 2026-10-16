import { z } from "zod";

export const REQUIRED_APPLICATION_FIELDS = [
  "nome", "whatsapp", "email", "instagram", "pais", "idade", "ocupacao",
  "experiencia", "o_que_travou", "tempo_dia", "verba_anuncios", "investimento", "decisao",
] as const;

export function firstMissingApplicationField(answers: Record<string, unknown>) {
  return REQUIRED_APPLICATION_FIELDS.find((key) =>
    typeof answers[key] !== "string" || !answers[key].trim());
}

const s = (max = 200) => z.string().trim().max(max).optional().nullable();
export const leadSchema = z.object({
  id: z.string().uuid().optional().nullable(), final: z.boolean().optional(),
  nome: s(120), whatsapp: s(30), email: z.string().trim().email().max(255).optional().nullable(),
  instagram: s(60), pais: s(), idade: s(), ocupacao: s(), experiencia: s(),
  o_que_travou: s(2000), tempo_dia: s(), verba_anuncios: s(), investimento: s(), decisao: s(),
  utm_source: s(), utm_medium: s(), utm_campaign: s(), utm_content: s(),
}).superRefine((data, ctx) => {
  if (!data.final) return;
  for (const key of REQUIRED_APPLICATION_FIELDS) {
    if (!data[key]?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: "Responde a esta pergunta." });
  }
});