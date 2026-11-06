/** Regras partilhadas para detetar leads duplicados (mesmo email ou mesmo telemóvel). */
export type DupLead = { id: string; email?: string | null; whatsapp?: string | null; created_at: string; status?: string | null };

export function normEmail(e?: string | null) {
  const v = (e ?? "").trim().toLowerCase();
  return v.includes("@") ? v : "";
}

/** Últimos 9 dígitos: ignora indicativo (+351, 00351…) e espaços. */
export function normPhone(p?: string | null) {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-9) : "";
}

/** IDs dos leads que repetem outro mais antigo (o original não leva badge). Incompletos são ignorados. */
export function duplicateIds(leads: DupLead[]): Set<string> {
  const seen = new Set<string>();
  const dups = new Set<string>();
  const sorted = leads.filter((l) => l.status !== "incompleto").sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const l of sorted) {
    const keys = [normEmail(l.email) && `e:${normEmail(l.email)}`, normPhone(l.whatsapp) && `p:${normPhone(l.whatsapp)}`].filter(Boolean) as string[];
    if (keys.some((k) => seen.has(k))) dups.add(l.id);
    keys.forEach((k) => seen.add(k));
  }
  return dups;
}
