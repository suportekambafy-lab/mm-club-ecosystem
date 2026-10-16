import { z } from "zod";

export const commercialRole = z.enum(["sdr", "closer", "none"]);
export const manualAccessSchema = z.object({
  userId: z.string().uuid(), months: z.union([z.literal(3), z.literal(6), z.literal(12)]),
  reason: z.string().trim().min(3).max(500),
});
export function canUseCommercial(roles: string[]) { return roles.some((role) => ["admin", "sdr", "closer"].includes(role)); }
export function canManageCommercialTeam(roles: string[]) { return roles.includes("admin"); }