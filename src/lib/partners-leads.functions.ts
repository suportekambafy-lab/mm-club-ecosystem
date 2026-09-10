/**
 * MM Partners — leads: quem chegou pelos links dos parceiros.
 * Mostra os registados (nome, email, data) e os cliques ainda sem conta.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PartnerLeadRow = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  code: string;
  partnerName: string;
  createdAt: string;
  firstPaidAt: string | null;
  paid: boolean;
  subscriptionStatus: string | null;
};

export type PartnerClickRow = {
  id: string;
  code: string;
  partnerName: string;
  createdAt: string;
  visitorKey: string | null;
};

export type PartnerLeadsData = {
  totals: {
    clicks: number;
    uniqueVisitors: number;
    signups: number;
    paid: number;
    pending: number;
  };
  leads: PartnerLeadRow[];
  clicks: PartnerClickRow[];
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export const getPartnerLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PartnerLeadsData> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: referrals }, { data: clicks }, { data: accounts }] = await Promise.all([
      supabaseAdmin
        .from("mm_partner_referrals")
        .select(
          "id, partner_id, referred_user_id, code, status, first_paid_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(1000),
      supabaseAdmin
        .from("mm_partner_clicks")
        .select("id, partner_id, code, visitor_key, created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabaseAdmin.from("mm_partner_accounts").select("id, user_id, code").limit(1000),
    ]);

    const accountList = accounts ?? [];
    const partnerUserIds = accountList.map((a) => a.user_id);
    const referralUserIds = (referrals ?? []).map((r) => r.referred_user_id).filter(Boolean);
    const allUserIds = Array.from(new Set([...partnerUserIds, ...referralUserIds]));

    const names = new Map<string, string>();
    const avatars = new Map<string, string | null>();
    const emails = new Map<string, string | null>();
    if (allUserIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", allUserIds);
      for (const p of profiles ?? []) {
        names.set(p.id, p.display_name ?? "");
        avatars.set(p.id, p.avatar_url ?? null);
      }
      await Promise.all(
        referralUserIds.slice(0, 300).map(async (id) => {
          const { data } = await supabaseAdmin.auth.admin.getUserById(id);
          emails.set(id, data?.user?.email ?? null);
        }),
      );
    }

    const subStatus = new Map<string, string>();
    if (referralUserIds.length) {
      const { data: subs } = await supabaseAdmin
        .from("billing_subscriptions")
        .select("user_id, status, updated_at")
        .in("user_id", referralUserIds.slice(0, 1000))
        .order("updated_at", { ascending: false });
      for (const s of subs ?? []) {
        if (!subStatus.has(s.user_id)) subStatus.set(s.user_id, s.status as string);
      }
    }

    const partnerNameById = new Map<string, string>();
    for (const a of accountList) {
      partnerNameById.set(a.id, names.get(a.user_id) || "Parceiro");
    }

    const leads: PartnerLeadRow[] = (referrals ?? []).map((r) => ({
      id: r.id,
      name: names.get(r.referred_user_id) || emails.get(r.referred_user_id) || "Membro",
      email: emails.get(r.referred_user_id) ?? null,
      avatarUrl: avatars.get(r.referred_user_id) ?? null,
      code: r.code,
      partnerName: partnerNameById.get(r.partner_id) ?? "Parceiro",
      createdAt: r.created_at,
      firstPaidAt: r.first_paid_at ?? null,
      paid: r.status === "paid" || Boolean(r.first_paid_at),
      subscriptionStatus: subStatus.get(r.referred_user_id) ?? null,
    }));

    const clickRows: PartnerClickRow[] = (clicks ?? []).map((c) => ({
      id: c.id,
      code: c.code,
      partnerName: partnerNameById.get(c.partner_id) ?? "Parceiro",
      createdAt: c.created_at,
      visitorKey: c.visitor_key ? c.visitor_key.slice(0, 8) : null,
    }));

    return {
      totals: {
        clicks: clickRows.length,
        uniqueVisitors: new Set(
          clickRows.map((c) => c.visitorKey ?? c.id).filter(Boolean),
        ).size,
        signups: leads.length,
        paid: leads.filter((l) => l.paid).length,
        pending: leads.filter((l) => !l.paid).length,
      },
      leads,
      clicks: clickRows,
    };
  });
