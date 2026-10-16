import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canDeleteMemberAccount, canManageMemberAccounts, deleteMemberSchema, memberDetailsSchema, updateMemberSchema } from "./member-rules";

export const createPlatformMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => memberDetailsSchema.parse(input)).handler(async ({ context, data }) => {
  const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !canManageMemberAccounts(Boolean(allowed))) throw new Error("Só administradores podem gerir contas.");
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const result = await db.auth.admin.inviteUserByEmail(data.email, { data: { display_name: data.name }, redirectTo: "https://mmclub.pt/reset-password" });
  if (result.error || !result.data.user) throw new Error("Não foi possível criar o utilizador. Verifica se o email já está registado.");
  const id = result.data.user.id;
  const profile = await db.from("profiles").update({ display_name: data.name }).eq("id", id);
  if (profile.error) throw new Error("O convite foi criado, mas não foi possível atualizar o nome.");
  await db.from("admin_action_log").insert({ actor_id: context.userId, action: "member.create", entity_type: "user", entity_id: id, after: { name: data.name, email: data.email } });
  return { id };
});

export const updatePlatformMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => updateMemberSchema.parse(input)).handler(async ({ context, data }) => {
  const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !canManageMemberAccounts(Boolean(allowed))) throw new Error("Só administradores podem gerir contas.");
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const original = await db.auth.admin.getUserById(data.userId);
  if (original.error || !original.data.user) throw new Error("Utilizador não encontrado.");
  const { data: roles, error: rolesError } = await db.from("user_roles").select("role").eq("user_id", data.userId);
  if (rolesError || roles?.some(role => role.role !== "user")) throw new Error("Contas da equipa devem ser geridas fora da lista de membros.");
  const updated = await db.auth.admin.updateUserById(data.userId, { email: data.email, user_metadata: { ...original.data.user.user_metadata, display_name: data.name } });
  if (updated.error) throw new Error("Não foi possível corrigir o email. Verifica se já pertence a outra conta.");
  const [profile, customer] = await Promise.all([db.from("profiles").update({ display_name: data.name }).eq("id", data.userId), db.from("billing_customers").update({ email: data.email }).eq("user_id", data.userId)]);
  if (profile.error || customer.error) throw new Error("O email de entrada foi atualizado; não foi possível sincronizar todos os dados. Tenta novamente.");
  await db.from("admin_action_log").insert({ actor_id: context.userId, action: "member.update", entity_type: "user", entity_id: data.userId, before: { email: original.data.user.email }, after: { email: data.email, name: data.name } });
  return { ok: true };
});

export const deletePlatformMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => deleteMemberSchema.parse(input)).handler(async ({ context, data }) => {
  const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !canManageMemberAccounts(Boolean(allowed))) throw new Error("Só administradores podem gerir contas.");
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [roles, subscriptions, payments] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", data.userId),
    db.from("billing_subscriptions").select("id").eq("user_id", data.userId).not("status", "in", "(cancelled,expired)"),
    db.from("billing_payments").select("id").eq("user_id", data.userId).in("status", ["pending", "authorized"]),
  ]);
  if (roles.error || subscriptions.error || payments.error) throw new Error("Não foi possível verificar se a conta pode ser eliminada.");
  if (!canDeleteMemberAccount(context.userId, data.userId, Boolean(roles.data?.some(role => role.role !== "user")), Boolean(subscriptions.data?.length || payments.data?.length))) throw new Error("Não é possível eliminar a tua conta, uma conta da equipa ou uma conta com subscrição/pagamento em curso.");
  const result = await db.auth.admin.deleteUser(data.userId);
  if (result.error) throw new Error("Não foi possível eliminar a conta. Pode ter registos associados que precisam de revisão.");
  await db.from("admin_action_log").insert({ actor_id: context.userId, action: "member.delete", entity_type: "user", entity_id: data.userId });
  return { ok: true };
});
