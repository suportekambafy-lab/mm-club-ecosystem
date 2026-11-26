import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LegacyActivationRow = { email: string; name: string; status: "ativou" | "ja_tinha_conta" | "por_ativar"; activatedAt: string | null; lastSignInAt: string | null };

export const listLegacyActivations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Sem permissão");
    const { LEGACY_STUDENTS } = await import("./legacy-students.server");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const users = new Map<string, { last: string | null }>();
    for (let page = 1; page < 20; page++) {
      const r = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (r.error) throw r.error;
      for (const u of r.data.users) if (u.email) users.set(u.email.toLowerCase(), { last: u.last_sign_in_at ?? null });
      if (r.data.users.length < 1000) break;
    }
    const { data: logs } = await db.from("admin_action_log").select("created_at, after").eq("action", "legacy.activate");
    const activated = new Map<string, string>();
    for (const l of logs ?? []) { const e = (l.after as { email?: string } | null)?.email?.toLowerCase(); if (e) activated.set(e, l.created_at); }
    const rows: LegacyActivationRow[] = Object.entries(LEGACY_STUDENTS).map(([email, name]) => {
      const u = users.get(email);
      const at = activated.get(email) ?? null;
      return { email, name, status: at ? "ativou" : u ? "ja_tinha_conta" : "por_ativar", activatedAt: at, lastSignInAt: u?.last ?? null };
    });
    rows.sort((a, b) => (b.activatedAt ?? "").localeCompare(a.activatedAt ?? "") || a.name.localeCompare(b.name));
    return rows;
  });
