/**
 * MM Product Lab — configuração editável pela equipa MM.
 *
 * Alterar critérios, pesos ou estados aqui muda a ferramenta inteira
 * (score, kanban, filtros) sem tocar na interface.
 */

export type PlStatus = "found" | "analysis" | "validated" | "testing" | "winner" | "rejected";

export const PL_STATUSES: { id: PlStatus; label: string; short: string }[] = [
  { id: "found", label: "Encontrados", short: "Encontrado" },
  { id: "analysis", label: "Em análise", short: "Em análise" },
  { id: "validated", label: "Validados", short: "Validado" },
  { id: "testing", label: "Em teste", short: "Em teste" },
  { id: "winner", label: "Vencedores", short: "Vencedor" },
  { id: "rejected", label: "Rejeitados", short: "Rejeitado" },
];

export function statusLabel(id: string): string {
  return PL_STATUSES.find((s) => s.id === id)?.short ?? id;
}

/** Critérios MM — cada nota vai de 0 a 10. Pesos relativos (somatório livre). */
export interface PlCriterion {
  id: string;
  label: string;
  help: string;
  weight: number;
}

export const PL_CRITERIA: PlCriterion[] = [
  { id: "demand", label: "Procura", help: "Existe procura real e consistente?", weight: 1.25 },
  { id: "creative", label: "Potencial de criativo", help: "Dá para mostrar em vídeo/imagem?", weight: 1.25 },
  { id: "margin", label: "Margem", help: "A margem sustenta tráfego pago?", weight: 1.15 },
  { id: "differentiation", label: "Diferenciação", help: "Destaca-se do que já existe?", weight: 1 },
  { id: "scale", label: "Potencial de escala", help: "Stock, logística e mercado permitem escalar?", weight: 1 },
  { id: "ease", label: "Facilidade de venda", help: "O valor percebido é imediato?", weight: 1 },
];

export const PL_MAX_NOTE = 10;

/** Score MM 0–100 a partir das notas por critério. */
export function computeScore(values: Record<string, number>): number | null {
  const filled = PL_CRITERIA.filter((c) => typeof values[c.id] === "number");
  if (filled.length === 0) return null;
  const totalWeight = filled.reduce((a, c) => a + c.weight, 0);
  const sum = filled.reduce((a, c) => a + (values[c.id] ?? 0) * c.weight, 0);
  return Math.round((sum / (totalWeight * PL_MAX_NOTE)) * 100);
}

export const PL_SOURCES = [
  "Meta Ads",
  "TikTok",
  "Ferramenta de Dropshipping",
  "Pesquisa própria",
  "Outro",
] as const;

export function scoreTone(score: number | null): { label: string; className: string } {
  if (score === null) return { label: "Sem score", className: "text-muted-foreground" };
  if (score >= 80) return { label: "Alto potencial", className: "text-primary" };
  if (score >= 60) return { label: "Promissor", className: "text-foreground" };
  if (score >= 40) return { label: "Precisa validar", className: "text-muted-foreground" };
  return { label: "Baixo potencial", className: "text-muted-foreground" };
}
