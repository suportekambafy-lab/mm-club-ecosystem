import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { commercialRole, manualAccessSchema } from "./rules";

export const commercialSession = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc("has_commercial_access", { _user_id: context.userId });
  if (error || !data) throw new Error("Sem permissão para a área comercial.");
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  return { isAdmin: Boolean(isAdmin), userId: context.userId };
});

export const commercialMembers = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ search: z.string().max(120).default("") }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: allowed } = await context.supabase.rpc("has_commercial_access", { _user_id: context.userId });
    if (!allowed) throw new Error("Sem permissão.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [profiles, customers, roles, grants, accounts] = await Promise.all([
      db.from("profiles").select("id, display_name, avatar_url, created_at").order("created_at", { ascending: false }).limit(2000),
      db.from("billing_customers").select("user_id, email"),
      db.from("user_roles").select("user_id, role").in("role", ["sdr", "closer"]),
      db.from("entitlement_grants").select("user_id, expires_at, source").eq("feature_key", "academy.access").is("revoked_at", null),
      db.auth.admin.listUsers({page:1,perPage:2000}),
    ]);
    if (profiles.error || customers.error || roles.error || grants.error || accounts.error) throw new Error("Não foi possível consultar os utilizadores.");
    const emailMap = new Map((customers.data ?? []).map(c => [c.user_id, c.email]));
    for (const user of accounts.data.users) { if (user.email) emailMap.set(user.id, user.email); }
    const roleMap = new Map((roles.data ?? []).map(r => [r.user_id, r.role]));
    const term = data.search.toLocaleLowerCase();
    return (profiles.data ?? []).map(p => {
      const active = (grants.data ?? []).filter(g => g.user_id === p.id && (!g.expires_at || Date.parse(g.expires_at) > Date.now()));
      const indefinite = active.some(g => !g.expires_at);
      const expiry = active.map(g => g.expires_at).filter((v): v is string => Boolean(v)).sort().at(-1) ?? null;
      return { ...p, email: emailMap.get(p.id) ?? null, role: roleMap.get(p.id) ?? null, hasAccess: active.length > 0, expiresAt: indefinite ? null : expiry };
    }).filter(p => `${p.display_name ?? ""} ${p.email ?? ""} ${p.id}`.toLocaleLowerCase().includes(term)).slice(0, 100);
  });

export const giveCommercialAccess = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => manualAccessSchema.parse(input)).handler(async ({ context, data }) => {
    const { data: expiresAt, error } = await context.supabase.rpc("grant_commercial_club_access", { _user_id: data.userId, _months: data.months, _reason: data.reason });
    if (error) throw new Error("Não foi possível atribuir o acesso. Confirma a tua permissão e tenta novamente.");
    return { expiresAt };
  });

export const changeCommercialRole = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid(), role: commercialRole }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("set_commercial_role", { _user_id: data.userId, _role: data.role });
    if (error) throw new Error("Só um administrador pode alterar a equipa.");
    return { ok: true };
  });