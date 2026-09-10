/**
 * MM Partners — funções do membro (parceiro).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PartnerReferralView = {
  id: string;
  name: string;
  status: string;
  joinedAt: string;
  rewardCents: number;
  rewardKind: string | null;
};

export type PartnerPayoutView = {
  id: string;
  amountCents: number;
  method: string;
  status: string;
  note: string | null;
  createdAt: string;
};

export type PartnerDashboard = {
  joined: boolean;
  code: string | null;
  link: string | null;
  activeCount: number;
  totalCount: number;
  clicks: number;
  uniqueClicks: number;
  freeBenefitActive: boolean;
  balanceCents: number;
  earnedCents: number;
  paidOutCents: number;
  minPayoutCents: number;
  cashRewardCents: number;
  freeSlots: number;
  payout: { method: string | null; target: string | null; holder: string | null };
  referrals: PartnerReferralView[];
  payouts: PartnerPayoutView[];
};

/** Domínio oficial do clube — os links de convite usam sempre este endereço. */
const SITE = "https://mmclub.pt";

async function loadDashboard(userId: string, origin?: string | null): Promise<PartnerDashboard> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const core = await import("@/lib/partners/core.server");

  const account = await core.findAccountByUser(userId);
  const base: PartnerDashboard = {
    joined: false,
    code: null,
    link: null,
    activeCount: 0,
    totalCount: 0,
    freeBenefitActive: false,
    balanceCents: 0,
    earnedCents: 0,
    paidOutCents: 0,
    minPayoutCents: core.MIN_PAYOUT_CENTS,
    cashRewardCents: core.CASH_REWARD_CENTS,
    freeSlots: core.FREE_SLOTS,
    payout: { method: null, target: null, holder: null },
    referrals: [],
    payouts: [],
  };
  if (!account) return base;

  const snapshot = await core.evaluatePartner(account.id);

  const [{ data: referrals }, { data: payouts }] = await Promise.all([
    supabaseAdmin
      .from("mm_partner_referrals")
      .select("id, referred_user_id, status, reward_cents, reward_kind, created_at")
      .eq("partner_id", account.id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("mm_partner_payouts")
      .select("id, amount_cents, method, status, note, created_at")
      .eq("partner_id", account.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const ids = (referrals ?? []).map((r) => r.referred_user_id);
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    for (const p of profiles ?? []) names.set(p.id, p.display_name ?? "");
  }

  const root = origin && origin.startsWith("http") ? origin.replace(/\/$/, "") : SITE;

  return {
    ...base,
    joined: true,
    code: account.code,
    link: `${root}/?ref=${account.code}`,
    activeCount: snapshot.activeCount,
    totalCount: snapshot.totalCount,
    freeBenefitActive: snapshot.freeBenefitActive,
    balanceCents: snapshot.balanceCents,
    earnedCents: snapshot.earnedCents,
    paidOutCents: snapshot.paidOutCents,
    payout: {
      method: account.payout_method,
      target: account.payout_target,
      holder: account.payout_holder,
    },
    referrals: (referrals ?? []).map((r) => {
      const full = names.get(r.referred_user_id) || "Membro";
      const first = full.split(" ")[0] ?? "Membro";
      return {
        id: r.id,
        name: first,
        status: r.status,
        joinedAt: r.created_at,
        rewardCents: r.reward_cents ?? 0,
        rewardKind: r.reward_kind ?? null,
      };
    }),
    payouts: (payouts ?? []).map((p) => ({
      id: p.id,
      amountCents: p.amount_cents,
      method: p.method,
      status: p.status,
      note: p.note ?? null,
      createdAt: p.created_at,
    })),
  };
}

export const getPartnerDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { origin?: string | null }) => ({
    origin: data?.origin ? String(data.origin).slice(0, 200) : null,
  }))
  .handler(async ({ context, data }) => loadDashboard(context.userId, data.origin));

export const joinPartners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { origin?: string | null }) => ({
    origin: data?.origin ? String(data.origin).slice(0, 200) : null,
  }))
  .handler(async ({ context, data }) => {
    const core = await import("@/lib/partners/core.server");
    await core.ensureAccount(context.userId);
    return loadDashboard(context.userId, data.origin);
  });

export const savePartnerPayoutDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { method?: string; target?: string; holder?: string }) => ({
    method: data?.method === "mbway" ? "mbway" : "iban",
    target: String(data?.target ?? "").trim().slice(0, 60),
    holder: String(data?.holder ?? "").trim().slice(0, 120),
  }))
  .handler(async ({ context, data }) => {
    if (!data.target) throw new Error("Indica o IBAN ou o número MB Way.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const core = await import("@/lib/partners/core.server");
    const account = await core.ensureAccount(context.userId);
    const { error } = await supabaseAdmin
      .from("mm_partner_accounts")
      .update({
        payout_method: data.method,
        payout_target: data.target,
        payout_holder: data.holder || null,
      })
      .eq("id", account.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const requestPartnerPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const core = await import("@/lib/partners/core.server");
    const account = await core.findAccountByUser(context.userId);
    if (!account) throw new Error("Ainda não fazes parte do MM Partners.");
    if (!account.payout_method || !account.payout_target) {
      throw new Error("Guarda primeiro os teus dados de pagamento.");
    }

    const { data: pending } = await supabaseAdmin
      .from("mm_partner_payouts")
      .select("id")
      .eq("partner_id", account.id)
      .eq("status", "requested")
      .maybeSingle();
    if (pending) throw new Error("Já tens um pedido de retirada em análise.");

    const { balanceCents } = await core.balanceOf(account.id);
    if (balanceCents < core.MIN_PAYOUT_CENTS) {
      throw new Error(
        `O saldo mínimo para retirar é ${(core.MIN_PAYOUT_CENTS / 100).toFixed(0)} €.`,
      );
    }

    const { data: payout, error } = await supabaseAdmin
      .from("mm_partner_payouts")
      .insert({
        partner_id: account.id,
        amount_cents: balanceCents,
        method: account.payout_method,
        target: account.payout_target,
        holder: account.payout_holder,
      })
      .select("id, amount_cents")
      .single();
    if (error) throw new Error(error.message);

    const { error: ledgerError } = await supabaseAdmin.from("mm_partner_ledger").insert({
      partner_id: account.id,
      kind: "withdrawal",
      amount_cents: -payout.amount_cents,
      ref_key: `payout:${payout.id}`,
      memo: "Pedido de retirada",
    });
    if (ledgerError) {
      await supabaseAdmin.from("mm_partner_payouts").delete().eq("id", payout.id);
      throw new Error(ledgerError.message);
    }

    return { ok: true, amountCents: payout.amount_cents };
  });

/** Liga o membro autenticado ao código de quem o convidou (uma única vez). */
export const claimPartnerReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { code?: string; source?: string }) => ({
    code: String(data?.code ?? "").trim().slice(0, 20),
    source: data?.source ? String(data.source).slice(0, 40) : "link",
  }))
  .handler(async ({ context, data }) => {
    if (!data.code) return { ok: false };
    const core = await import("@/lib/partners/core.server");
    const res = await core.attachReferral({
      code: data.code,
      referredUserId: context.userId,
      source: data.source,
    });
    return { ok: res.ok };
  });
