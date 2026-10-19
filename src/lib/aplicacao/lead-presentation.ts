export type LeadOwnership = {
  responsavel_id?: string | null;
  responsavel?: string | null;
  status?: string;
  sale_closed_by?: string | null;
  call_scheduled_by?: string | null;
};

export function isLeadLocked(lead: LeadOwnership, me: string): boolean {
  return Boolean(lead.responsavel_id && lead.responsavel_id !== me);
}

export function leadAttribution(lead: LeadOwnership, names: Record<string, string> = {}) {
  if (lead.status !== "fechou" && lead.status !== "call_marcada") return null;
  const actorId = lead.status === "fechou" ? lead.sale_closed_by ?? lead.responsavel_id : lead.call_scheduled_by ?? lead.responsavel_id;
  const name = actorId && names[actorId] ? names[actorId] :
    actorId === lead.responsavel_id || !actorId ? lead.responsavel : null;
  return { kind: lead.status === "fechou" ? "sale" as const : "call" as const, actorId, name: name || "—" };
}
/** Só SDR (ou admin) marca calls; um closer apenas recebe calls. */
export function canScheduleCall(roles: string[]): boolean {
  return roles.includes("admin") || roles.includes("sdr");
}
