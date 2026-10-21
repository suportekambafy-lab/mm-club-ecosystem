import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canConfirmCommercialAccount } from "./confirmation-rules";

export const updateCommercialCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    userId: z.string().uuid(),
    email: z.string().trim().email(),
    password: z.string().min(8).max(128),
  }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !isAdmin) throw new Error("Só administradores podem alterar os acessos da equipa.");
    const { data: roles, error: roleError } = await context.supabase.from("user_roles").select("role").eq("user_id", data.userId);
    if (roleError || !canConfirmCommercialAccount(Boolean(isAdmin), (roles ?? []).map(row => row.role))) throw new Error("Esta conta não pertence à equipa comercial.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const original = await db.auth.admin.getUserById(data.userId);
    if (original.error || !original.data.user) throw new Error("Conta não encontrada.");
    const result = await db.auth.admin.updateUserById(data.userId, { email: data.email, password: data.password });
    if (result.error) throw new Error("Não foi possível atualizar os acessos da equipa.");
    const customer = await db.from("billing_customers").update({ email: data.email }).eq("user_id", data.userId);
    if (customer.error) throw new Error("Acesso atualizado, mas não foi possível sincronizar o email de faturação.");
    const audit = await db.from("admin_action_log").insert({ actor_id: context.userId, action: "commercial.update_credentials", entity_type: "user", entity_id: data.userId, before: { email: original.data.user.email }, after: { email: data.email, password_changed: true } });
    if (audit.error) throw new Error("Acesso atualizado, mas não foi possível registar a ação.");
    return { ok: true };
  });