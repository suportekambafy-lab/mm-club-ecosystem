import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canConfirmCommercialAccount } from "./confirmation-rules";

export const confirmCommercialAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !isAdmin) throw new Error("Só administradores podem confirmar contas.");
    const { data: roles, error: roleError } = await context.supabase.from("user_roles").select("role").eq("user_id", data.userId);
    if (roleError || !canConfirmCommercialAccount(Boolean(isAdmin), (roles ?? []).map(row => row.role))) throw new Error("Esta conta não pertence à equipa comercial.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const original = await db.auth.admin.getUserById(data.userId);
    if (original.error || !original.data.user) throw new Error("Conta não encontrada.");
    if (original.data.user.email_confirmed_at) return { ok: true };
    const result = await db.auth.admin.updateUserById(data.userId, { email_confirm: true });
    if (result.error) throw new Error("Não foi possível confirmar o email.");
    const audit = await db.from("admin_action_log").insert({ actor_id: context.userId, action: "commercial.confirm_email", entity_type: "user", entity_id: data.userId, after: { email: original.data.user.email, confirmed: true } });
    if (audit.error) throw new Error("Email confirmado, mas não foi possível registar a ação.");
    return { ok: true };
  });