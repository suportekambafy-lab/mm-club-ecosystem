import { z } from "zod";
export const memberDetailsSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254).transform(value => value.toLowerCase()) });
export const updateMemberSchema = memberDetailsSchema.extend({ userId: z.string().uuid() });
export const deleteMemberSchema = z.object({ userId: z.string().uuid(), confirmation: z.literal("ELIMINAR") });
export function canManageMemberAccounts(isAdmin: boolean) { return isAdmin; }
export function canDeleteMemberAccount(actorId: string, targetId: string, privileged: boolean, liveBilling: boolean) { return actorId !== targetId && !privileged && !liveBilling; }
