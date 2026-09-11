/**
 * MM Partners — vista de administração: parceiros, indicados e retiradas.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminPartnerRow = {
  partnerId: string;
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  code: string;
  clicks: number;
  activeCount: number;
  totalCount: number;
  freeBenefitActive: boolean;
  balanceCents: number;
  earnedCents: number;
  paidOutCents: number;
};

export type AdminPayoutRow = {
  id: string;
  partnerId: string;
  name: string;
  email: string | null;
  amountCents: number;
  method: string;
  target: string;
  holder: string | null;
  status: string;
  note: string | null;
  createdAt: string;
};

export type AdminPartnersData = {
  totals: {
    partners: number;
    activeReferrals: number;
    freeBenefits: number;
    pendingPayoutCents: number;
    paidOutCents: number;
  };
  partners: AdminPartnerRow[];
  payouts: AdminPayoutRow[];
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export const getPartnersOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPartnersData> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const core = await import("@/lib/partners/core.server");

    const { data: accounts } = await supabaseAdmin
      .from("mm_partner_accounts")
      .select("id, user_id, code, free_benefit_active")
      .order("created_at", { ascending: false })
      .limit(500);

    const list = accounts ?? [];
    const ids = list.map((a) => a.id);

    const [{ data: referrals }, { data: ledger }, { data: payouts }, { data: clicks }] =
      await Promise.all([
        ids.length
          ? supabaseAdmin
              .from("mm_partner_referrals")
              .select("partner_id, status")
              .in("partner_id", ids)
          : Promise.resolve({ data: [] as { partner_id: string; status: string }[] }),
        ids.length
          ? supabaseAdmin
              .from("mm_partner_ledger")
              .select("partner_id, amount_cents")
              .in("partner_id", ids)
          : Promise.resolve({ data: [] as { partner_id: string; amount_cents: number }[] }),
        supabaseAdmin
          .from("mm_partner_payouts")
          .select("id, partner_id, amount_cents, method, target, holder, status, note, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        ids.length
          ? supabaseAdmin
              .from("mm_partner_clicks")
              .select("partner_id, visitor_key")
              .in("partner_id", ids)
              .limit(20000)
          : Promise.resolve({
              data: [] as { partner_id: string; visitor_key: string | null }[],
            }),
      ]);

    const counts = new Map<string, { active: number; total: number }>();
    for (const r of referrals ?? []) {
      const c = counts.get(r.partner_id) ?? { active: 0, total: 0 };
      c.total += 1;
      if (r.status === "paid") c.active += 1;
      counts.set(r.partner_id, c);
    }

    const clickCounts = new Map<string, number>();
    for (const c of clicks ?? []) {
      clickCounts.set(c.partner_id, (clickCounts.get(c.partner_id) ?? 0) + 1);
    }

    const money = new Map<string, { earned: number; paid: number }>();
    for (const l of ledger ?? []) {
      const m = money.get(l.partner_id) ?? { earned: 0, paid: 0 };
      if (l.amount_cents >= 0) m.earned += l.amount_cents;
      else m.paid += -l.amount_cents;
      money.set(l.partner_id, m);
    }

    const userIds = list.map((a) => a.user_id);
    const names = new Map<string, string>();
    const avatars = new Map<string, string | null>();
    const emails = new Map<string, string | null>();
    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        names.set(p.id, p.display_name ?? "");
        avatars.set(p.id, p.avatar_url ?? null);
      }
      await Promise.all(
        userIds.slice(0, 200).map(async (id) => {
          const { data } = await supabaseAdmin.auth.admin.getUserById(id);
          emails.set(id, data?.user?.email ?? null);
        }),
      );
    }

    const partners: AdminPartnerRow[] = list.map((a) => {
      const c = counts.get(a.id) ?? { active: 0, total: 0 };
      const m = money.get(a.id) ?? { earned: 0, paid: 0 };
      return {
        partnerId: a.id,
        userId: a.user_id,
        name: names.get(a.user_id) || emails.get(a.user_id) || "Membro",
        email: emails.get(a.user_id) ?? null,
        avatarUrl: avatars.get(a.user_id) ?? null,
        code: a.code,
        clicks: clickCounts.get(a.id) ?? 0,
        activeCount: c.active,
        totalCount: c.total,
        freeBenefitActive: a.free_benefit_active,
        balanceCents: m.earned - m.paid,
        earnedCents: m.earned,
        paidOutCents: m.paid,
      };
    });

    const byId = new Map(partners.map((p) => [p.partnerId, p]));
    const payoutRows: AdminPayoutRow[] = (payouts ?? []).map((p) => ({
      id: p.id,
      partnerId: p.partner_id,
      name: byId.get(p.partner_id)?.name ?? "Membro",
      email: byId.get(p.partner_id)?.email ?? null,
      amountCents: p.amount_cents,
      method: p.method,
      target: p.target,
      holder: p.holder ?? null,
      status: p.status,
      note: p.note ?? null,
      createdAt: p.created_at,
    }));

    return {
      totals: {
        partners: partners.length,
        activeReferrals: partners.reduce((s, p) => s + p.activeCount, 0),
        freeBenefits: partners.filter((p) => p.freeBenefitActive).length,
        pendingPayoutCents: payoutRows
          .filter((p) => p.status === "requested")
          .reduce((s, p) => s + p.amountCents, 0),
        paidOutCents: payoutRows
          .filter((p) => p.status === "paid")
          .reduce((s, p) => s + p.amountCents, 0),
      },
      partners: partners.sort(
        (a, b) => b.activeCount - a.activeCount || b.earnedCents - a.earnedCents,
      ),
      payouts: payoutRows,
    };
  });

/** Marca uma retirada como paga ou recusada (devolvendo o saldo). */
export const decidePartnerPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { payoutId?: string; decision?: string; note?: string }) => ({
    payoutId: String(data?.payoutId ?? ""),
    decision: data?.decision === "rejected" ? "rejected" : "paid",
    note: data?.note ? String(data.note).slice(0, 300) : null,
  }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (!data.payoutId) throw new Error("Pedido inválido");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: payout } = await supabaseAdmin
      .from("mm_partner_payouts")
      .select("id, partner_id, amount_cents, status")
      .eq("id", data.payoutId)
      .maybeSingle();
    if (!payout) throw new Error("Pedido não encontrado");
    if (payout.status !== "requested") throw new Error("Este pedido já foi decidido.");

    const { error } = await supabaseAdmin
      .from("mm_partner_payouts")
      .update({
        status: data.decision,
        note: data.note,
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", payout.id);
    if (error) throw new Error(error.message);

    if (data.decision === "rejected") {
      // Devolve o valor ao saldo do parceiro.
      await supabaseAdmin.from("mm_partner_ledger").insert({
        partner_id: payout.partner_id,
        kind: "adjustment",
        amount_cents: payout.amount_cents,
        ref_key: `payout_reverse:${payout.id}`,
        memo: "Retirada recusada — saldo devolvido",
      });
    }

    return { ok: true };
  });

/** Ajuste manual de saldo (bónus ou correção). */
export const adjustPartnerBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { partnerId?: string; amountCents?: number; memo?: string }) => ({
    partnerId: String(data?.partnerId ?? ""),
    amountCents: Math.round(Number(data?.amountCents ?? 0)),
    memo: String(data?.memo ?? "Ajuste manual").slice(0, 200),
  }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (!data.partnerId || !data.amountCents) throw new Error("Valor inválido");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("mm_partner_ledger").insert({
      partner_id: data.partnerId,
      kind: "adjustment",
      amount_cents: data.amountCents,
      ref_key: `adjust:${data.partnerId}:${Date.now()}`,
      memo: data.memo,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type PartnerApplicationRow = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  code: string;
  status: string;
  note: string | null;
  requestedAt: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  subscriptionStatus: string | null;
};

/** Pedidos de adesão ao MM Partners (pendentes primeiro). */
export const getPartnerApplications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ pending: number; rows: PartnerApplicationRow[] }> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: accounts } = await supabaseAdmin
      .from("mm_partner_accounts")
      .select(
        "id, user_id, code, status, application_note, requested_at, decided_at, decision_note",
      )
      .order("requested_at", { ascending: false })
      .limit(500);

    const list = accounts ?? [];
    const userIds = list.map((a) => a.user_id);
    const names = new Map<string, string>();
    const avatars = new Map<string, string | null>();
    const emails = new Map<string, string | null>();
    const subStatus = new Map<string, string>();

    if (userIds.length) {
      const [{ data: profiles }, { data: subs }] = await Promise.all([
        supabaseAdmin.from("profiles").select("id, display_name, avatar_url").in("id", userIds),
        supabaseAdmin
          .from("billing_subscriptions")
          .select("user_id, status, updated_at")
          .in("user_id", userIds)
          .order("updated_at", { ascending: false }),
      ]);
      for (const p of profiles ?? []) {
        names.set(p.id, p.display_name ?? "");
        avatars.set(p.id, p.avatar_url ?? null);
      }
      for (const s of subs ?? []) {
        if (!subStatus.has(s.user_id)) subStatus.set(s.user_id, s.status as string);
      }
      await Promise.all(
        userIds.slice(0, 200).map(async (id) => {
          const { data } = await supabaseAdmin.auth.admin.getUserById(id);
          emails.set(id, data?.user?.email ?? null);
        }),
      );
    }

    const rows: PartnerApplicationRow[] = list.map((a) => ({
      id: a.id,
      userId: a.user_id,
      name: names.get(a.user_id) || emails.get(a.user_id) || "Membro",
      email: emails.get(a.user_id) ?? null,
      avatarUrl: avatars.get(a.user_id) ?? null,
      code: a.code,
      status: a.status,
      note: a.application_note ?? null,
      requestedAt: a.requested_at ?? null,
      decidedAt: a.decided_at ?? null,
      decisionNote: a.decision_note ?? null,
      subscriptionStatus: subStatus.get(a.user_id) ?? null,
    }));

    const order = { pending: 0, active: 1, rejected: 2 } as Record<string, number>;
    rows.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));

    return { pending: rows.filter((r) => r.status === "pending").length, rows };
  });

/** Aprova ou recusa um pedido de adesão. */
export const decidePartnerApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { accountId?: string; decision?: string; note?: string }) => ({
    accountId: String(data?.accountId ?? ""),
    decision: data?.decision === "rejected" ? "rejected" : "active",
    note: data?.note ? String(data.note).slice(0, 300) : null,
  }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (!data.accountId) throw new Error("Pedido inválido");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const core = await import("@/lib/partners/core.server");

    const { data: account } = await supabaseAdmin
      .from("mm_partner_accounts")
      .select("id, user_id, status")
      .eq("id", data.accountId)
      .maybeSingle();
    if (!account) throw new Error("Pedido não encontrado");

    if (data.decision === "active") {
      const eligibility = await core.partnerEligibility(account.user_id);
      if (!eligibility.ok) throw new Error(eligibility.reason ?? "Conta com dívida em aberto.");
    }

    const { error } = await supabaseAdmin
      .from("mm_partner_accounts")
      .update({
        status: data.decision,
        decision_note: data.note,
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);
    if (error) throw new Error(error.message);

    if (data.decision === "active") {
      try {
        await core.evaluatePartner(account.id);
      } catch (err) {
        console.error("[mm-partners] evaluate after approval failed", err);
      }
    }

    return { ok: true };
  });
