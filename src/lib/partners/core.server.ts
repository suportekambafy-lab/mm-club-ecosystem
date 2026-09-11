/**
 * MM Partners — motor de indicações.
 *
 * Regras:
 *  - Contam apenas indicados com plano pago ativo (trial não conta).
 *  - Com 3 indicados ativos ao mesmo tempo, o parceiro tem o MM Club Start
 *    grátis: recebe acesso garantido e, se já pagar mensalidade, o valor do
 *    Start volta em saldo cada mês.
 *  - A partir do 4.º indicado pago: 10 € uma única vez por indicado.
 *  - O saldo é retirado a pedido, com aprovação da equipa.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { grantFeature, revokeBySource } from "@/lib/entitlements/grants.server";

export const CASH_REWARD_CENTS = 1000;
export const FREE_SLOTS = 3;
export const START_PRICE_CENTS = 2990;
export const MIN_PAYOUT_CENTS = 2500;

const MM_CLUB_FEATURES = [
  "academy.access",
  "academy.premium",
  "lives.access",
  "lives.replay",
  "community.access",
  "shorts.publish",
  "ai.assistant",
  "studio.access",
  "events.access",
];

/**
 * Só conta quem paga a sério: subscrição ativa, fora do período de teste e com
 * pelo menos um pagamento confirmado. Dívida (grace_period) não conta.
 */
const PAID_STATUS = ["active"] as const;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(len = 7): string {
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export type PartnerAccountRow = {
  id: string;
  user_id: string;
  code: string;
  status: string;
  payout_method: string | null;
  payout_target: string | null;
  payout_holder: string | null;
  free_benefit_active: boolean;
  free_benefit_since: string | null;
  accepted_at: string;
  application_note: string | null;
  requested_at: string | null;
  decided_at: string | null;
  decision_note: string | null;
};

const ACCOUNT_COLUMNS =
  "id, user_id, code, status, payout_method, payout_target, payout_holder, free_benefit_active, free_benefit_since, accepted_at, application_note, requested_at, decided_at, decision_note";

export async function findAccountByUser(
  userId: string,
): Promise<PartnerAccountRow | null> {
  const { data } = await supabaseAdmin
    .from("mm_partner_accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as PartnerAccountRow | null) ?? null;
}

/**
 * Quem está em dívida não pode candidatar-se: primeiro regulariza a conta.
 */
export async function partnerEligibility(
  userId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const { getOutstanding } = await import("@/lib/billing/debt.server");
  const debt = await getOutstanding(userId);
  const blocked = ["past_due", "grace_period", "suspended", "expired"];
  if ((debt.status && blocked.includes(debt.status)) || debt.amountCents > 0) {
    return {
      ok: false,
      reason:
        "A tua conta está suspensa ou com valores em atraso. Regulariza a dívida em /subscricao para te candidatares ao MM Partners.",
    };
  }
  return { ok: true };
}

/** Cria (ou devolve) a conta de parceiro do membro. */
export async function ensureAccount(
  userId: string,
  init?: { status?: string; applicationNote?: string | null },
): Promise<PartnerAccountRow> {
  const existing = await findAccountByUser(userId);
  if (existing) return existing;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomCode();
    const { data, error } = await supabaseAdmin
      .from("mm_partner_accounts")
      .insert({
        user_id: userId,
        code,
        status: init?.status ?? "pending",
        application_note: init?.applicationNote ?? null,
        requested_at: new Date().toISOString(),
      })
      .select(ACCOUNT_COLUMNS)
      .maybeSingle();
    if (data) return data as PartnerAccountRow;
    // 23505: código repetido (tenta outro) ou conta já criada em paralelo.
    if (error?.code === "23505") {
      const again = await findAccountByUser(userId);
      if (again) return again;
      continue;
    }
    if (error) throw new Error(error.message);
  }
  throw new Error("Não foi possível criar a conta de parceiro");
}

/** Liga um novo membro ao parceiro que o trouxe (uma única vez). */
export async function attachReferral(input: {
  code: string;
  referredUserId: string;
  source?: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  const code = input.code.trim().toUpperCase();
  if (!code) return { ok: false, reason: "sem-codigo" };

  const { data: account } = await supabaseAdmin
    .from("mm_partner_accounts")
    .select("id, user_id, status")
    .eq("code", code)
    .maybeSingle();
  if (!account || account.status !== "active") return { ok: false, reason: "codigo-invalido" };
  if (account.user_id === input.referredUserId) return { ok: false, reason: "auto-indicacao" };

  const { data: already } = await supabaseAdmin
    .from("mm_partner_referrals")
    .select("id")
    .eq("referred_user_id", input.referredUserId)
    .maybeSingle();
  if (already) return { ok: false, reason: "ja-indicado" };

  const { error } = await supabaseAdmin.from("mm_partner_referrals").insert({
    partner_id: account.id,
    referred_user_id: input.referredUserId,
    code,
    source: input.source ?? null,
  });
  if (error && error.code !== "23505") return { ok: false, reason: error.message };

  await evaluatePartner(account.id);
  return { ok: true };
}

type PaidState = { paid: boolean; trial: boolean; cancelled: boolean };

/** Estado de pagamento de cada indicado (uma consulta por lote). */
async function paidStates(userIds: string[]): Promise<Map<string, PaidState>> {
  const out = new Map<string, PaidState>();
  if (!userIds.length) return out;

  const [{ data: subs }, { data: payments }] = await Promise.all([
    supabaseAdmin
      .from("billing_subscriptions")
      .select("user_id, status, trial_end, current_period_end, created_at")
      .in("user_id", userIds)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("billing_payments")
      .select("user_id, amount_cents, status")
      .in("user_id", userIds)
      .eq("status", "paid"),
  ]);

  // Pagamento real: pelo menos um pagamento confirmado com valor > 0
  // (a verificação de cartão de 1 € do trial não conta).
  const reallyPaid = new Set<string>();
  for (const p of payments ?? []) {
    if (p.user_id && (p.amount_cents ?? 0) > 100) reallyPaid.add(p.user_id);
  }

  const now = Date.now();
  for (const s of subs ?? []) {
    const prev = out.get(s.user_id);
    const inTrial = Boolean(s.trial_end && new Date(s.trial_end).getTime() > now);
    const live = (PAID_STATUS as readonly string[]).includes(s.status);
    const periodOk =
      !s.current_period_end || new Date(s.current_period_end).getTime() > now;
    const paid = live && !inTrial && periodOk && reallyPaid.has(s.user_id);
    const state: PaidState = {
      paid: paid || Boolean(prev?.paid),
      trial: inTrial || Boolean(prev?.trial),
      cancelled:
        !paid &&
        !inTrial &&
        ["cancelled", "expired", "suspended", "past_due", "grace_period"].includes(
          s.status,
        ),
    };
    out.set(s.user_id, state);
  }
  return out;
}

/** Cliques no link do parceiro (total e dispositivos diferentes). */
export async function clicksOf(
  partnerId: string,
): Promise<{ clicks: number; uniqueClicks: number }> {
  const { data } = await supabaseAdmin
    .from("mm_partner_clicks")
    .select("visitor_key")
    .eq("partner_id", partnerId)
    .limit(5000);
  const rows = data ?? [];
  const unique = new Set(rows.map((r) => r.visitor_key ?? "").filter(Boolean));
  return { clicks: rows.length, uniqueClicks: unique.size || rows.length };
}

/** O parceiro paga mensalidade agora? (para devolver o valor do Start) */
async function partnerPays(userId: string): Promise<boolean> {
  const states = await paidStates([userId]);
  return Boolean(states.get(userId)?.paid);
}

export type PartnerSnapshot = {
  activeCount: number;
  totalCount: number;
  freeBenefitActive: boolean;
  balanceCents: number;
  earnedCents: number;
  paidOutCents: number;
};

/**
 * Recalcula o estado de um parceiro: estados dos indicados, recompensas em
 * falta e benefício grátis. Idempotente — pode correr quantas vezes quiser.
 */
export async function evaluatePartner(partnerId: string): Promise<PartnerSnapshot> {
  const { data: account } = await supabaseAdmin
    .from("mm_partner_accounts")
    .select("id, user_id, free_benefit_active")
    .eq("id", partnerId)
    .maybeSingle();
  if (!account) throw new Error("Parceiro não encontrado");

  const { data: referrals } = await supabaseAdmin
    .from("mm_partner_referrals")
    .select("id, referred_user_id, status, first_paid_at, reward_kind, reward_cents")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: true });

  const list = referrals ?? [];
  const states = await paidStates(list.map((r) => r.referred_user_id));

  // 1) Atualiza estados e marca o primeiro pagamento.
  const nowIso = new Date().toISOString();
  let activeCount = 0;
  for (const r of list) {
    const st = states.get(r.referred_user_id) ?? {
      paid: false,
      trial: false,
      cancelled: false,
    };
    if (st.paid) activeCount += 1;
    const status = st.paid ? "paid" : st.trial ? "trial" : st.cancelled ? "lapsed" : "pending";
    const firstPaidAt = r.first_paid_at ?? (st.paid ? nowIso : null);
    if (status !== r.status || firstPaidAt !== r.first_paid_at) {
      await supabaseAdmin
        .from("mm_partner_referrals")
        .update({ status, first_paid_at: firstPaidAt })
        .eq("id", r.id);
      r.status = status;
      r.first_paid_at = firstPaidAt;
    }
  }

  // 2) Recompensas: os 3 primeiros pagos dão o benefício grátis; do 4.º em
  //    diante, 10 € uma única vez por indicado.
  const everPaid = list
    .filter((r) => r.first_paid_at)
    .sort(
      (a, b) =>
        new Date(a.first_paid_at!).getTime() - new Date(b.first_paid_at!).getTime(),
    );

  for (let i = 0; i < everPaid.length; i += 1) {
    const r = everPaid[i];
    if (r.reward_kind) continue;
    const isCash = i + 1 > FREE_SLOTS;
    if (isCash) {
      await supabaseAdmin.from("mm_partner_ledger").insert({
        partner_id: partnerId,
        kind: "cash_reward",
        amount_cents: CASH_REWARD_CENTS,
        referral_id: r.id,
        ref_key: `reward:${r.id}`,
        memo: "Indicação paga",
      });
    }
    await supabaseAdmin
      .from("mm_partner_referrals")
      .update({
        reward_kind: isCash ? "cash" : "free_slot",
        reward_cents: isCash ? CASH_REWARD_CENTS : 0,
        rewarded_at: nowIso,
      })
      .eq("id", r.id);
  }

  // 3) Benefício grátis enquanto houver 3 indicados a pagar.
  const benefit = activeCount >= FREE_SLOTS;
  if (benefit) {
    const expires = new Date(Date.now() + 3 * 86400000).toISOString();
    for (const key of MM_CLUB_FEATURES) {
      await grantFeature({
        userId: account.user_id,
        featureKey: key,
        source: "promo",
        sourceId: partnerId,
        expiresAt: expires,
        metadata: { reason: "mm_partners_free" },
      });
    }
    // Se já paga mensalidade, devolvemos o valor do Start em saldo, uma vez por mês.
    if (await partnerPays(account.user_id)) {
      const month = nowIso.slice(0, 7);
      await supabaseAdmin.from("mm_partner_ledger").insert({
        partner_id: partnerId,
        kind: "free_month",
        amount_cents: START_PRICE_CENTS,
        ref_key: `freemonth:${partnerId}:${month}`,
        memo: "Mês grátis MM Partners (3 indicados ativos)",
      });
    }
  } else if (account.free_benefit_active) {
    await revokeBySource({
      userId: account.user_id,
      source: "promo",
      sourceId: partnerId,
    });
  }

  await supabaseAdmin
    .from("mm_partner_accounts")
    .update({
      free_benefit_active: benefit,
      free_benefit_since: benefit
        ? account.free_benefit_active
          ? undefined
          : nowIso
        : null,
      updated_at: nowIso,
    })
    .eq("id", partnerId);

  const totals = await balanceOf(partnerId);
  return {
    activeCount,
    totalCount: list.length,
    freeBenefitActive: benefit,
    ...totals,
  };
}

export async function balanceOf(
  partnerId: string,
): Promise<{ balanceCents: number; earnedCents: number; paidOutCents: number }> {
  const { data } = await supabaseAdmin
    .from("mm_partner_ledger")
    .select("kind, amount_cents")
    .eq("partner_id", partnerId);

  let earned = 0;
  let paidOut = 0;
  for (const row of data ?? []) {
    if (row.amount_cents >= 0) earned += row.amount_cents;
    else paidOut += -row.amount_cents;
  }
  return { balanceCents: earned - paidOut, earnedCents: earned, paidOutCents: paidOut };
}

/** Reavalia todos os parceiros (usado pelo heartbeat de billing). */
export async function sweepPartners(limit = 50): Promise<number> {
  const { data } = await supabaseAdmin
    .from("mm_partner_accounts")
    .select("id")
    .eq("status", "active")
    .order("updated_at", { ascending: true })
    .limit(limit);

  let done = 0;
  for (const a of data ?? []) {
    try {
      await evaluatePartner(a.id);
      done += 1;
    } catch (err) {
      console.error("[mm-partners] evaluate failed", a.id, err);
    }
  }
  return done;
}
