import { z } from "zod";
import { canScheduleCall, isLeadLocked, type LeadOwnership } from "@/lib/aplicacao/lead-presentation";

export const serviceUpdateSchema = z.discriminatedUnion("status", [
  z.object({ id: z.string().uuid(), status: z.literal("call_marcada"), callScheduledAt: z.string().datetime(), closerId: z.string().uuid() }),
  z.object({ id: z.string().uuid(), status: z.enum(["novo", "em_contacto", "concluido", "descartado"]) }),
]);
export function canScheduleServiceCall(lead: LeadOwnership | null, me: string, roles: string[]) {
  return canScheduleCall(roles) && lead?.status !== "fechou" && (!lead || !isLeadLocked(lead, me) || (lead.status === "call_marcada" && lead.call_scheduled_by === me));
}