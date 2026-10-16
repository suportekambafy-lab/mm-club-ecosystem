import { z } from "zod";

export const commercialRole = z.enum(["sdr", "closer", "none"]);
export const accessDurationSchema = z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12), z.literal("lifetime")]);
export type AccessDuration = z.infer<typeof accessDurationSchema>;
export const ACCESS_DURATIONS = [1, 3, 6, 12, "lifetime"] as const;
export function accessDurationLabel(value: AccessDuration) { return value === "lifetime" ? "Vitalício" : value === 1 ? "1 mês" : `${value} meses`; }
export const manualAccessSchema = z.object({
  userId: z.string().uuid(), months: accessDurationSchema,
  reason: z.string().trim().min(3).max(500),
});
export function canUseCommercial(roles: string[]) { return roles.some((role) => ["admin", "sdr", "closer"].includes(role)); }
export function canManageCommercialTeam(roles: string[]) { return roles.includes("admin"); }