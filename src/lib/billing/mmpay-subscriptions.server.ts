/**
 * MMpay — motor de assinaturas. O MM Club gere o ciclo; a Viva só processa as cobranças.
 * Garantias contra duplicação:
 *  - ativação: UNIQUE(viva_initial_order_code) → repetir o webhook/retorno não cria 2 assinaturas;
 *  - cobranças: claim atómico (locked_until + SKIP LOCKED) e índice único de 1 cobrança
 *    "processing|paid" por ciclo → dois jobs nunca cobram o mesmo ciclo.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  afterFailedCharge,
  afterPaidCharge,
  splitInstallments,
  type BillingInterval,
} from "@/lib/mmpay/subscription-rules";
import type { MmpayLinkRow } from "./mmpay.server";

export async function activateSubscriptionFromFirstPayment(input: {
  link: MmpayLinkRow;
  orderCode: string;
  transactionId: string | null;
  email: string;
  name: string | null;
  phone: string | null;
  amountCents: number;
}): Promise<void> {
  const { link } = input;
  const interval = link.billing_interval as BillingInterval;
  const count = link.billing_interval_count ?? 1;
  const now = new Date();
  const next = afterPaidCharge({ chargesDone: 1, totalCycles: link.total_cycles, interval, intervalCount: count, anchor: now });
  const { data: sub, error } = await supabaseAdmin
    .from("mmpay_subscriptions")
    .insert({
      link_id: link.id,
      product_title: link.title,
      customer_email: input.email,
      customer_name: input.name,
      customer_phone: input.phone,
      amount_cents: input.amountCents,
      billing_interval: interval,
      billing_interval_count: count,
      total_cycles: link.total_cycles,
      total_amount_cents: link.total_amount_cents,
      charges_count: 1,
      status: next.status,
      started_at: now.toISOString(),
      last_charge_at: now.toISOString(),
      next_charge_at: next.nextChargeAt?.toISOString() ?? null,
      completed_at: next.status === "completed" ? now.toISOString() : null,
      viva_initial_order_code: input.orderCode,
      viva_initial_transaction_id: input.transactionId,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return; // já ativada (webhook + retorno)
    throw new Error(error.message);
  }
  await supabaseAdmin.from("mmpay_subscription_charges").insert({
    subscription_id: sub.id,
    cycle_number: 1,
    attempt: 1,
    amount_cents: input.amountCents,
    status: "paid",
    viva_transaction_id: input.transactionId,
    viva_order_code: input.orderCode,
    finished_at: now.toISOString(),
  });
}

type SubRow = {
  id: string;
  product_title: string;
  amount_cents: number;
  billing_interval: string;
  billing_interval_count: number;
  total_cycles: number | null;
  total_amount_cents: number | null;
  charges_count: number;
  status: string;
  failed_attempts: number;
  next_charge_at: string | null;
  viva_initial_transaction_id: string | null;
};

async function chargeOne(sub: SubRow): Promise<"paid" | "failed" | "skipped"> {
  const cycle = sub.charges_count + 1;
  const attempt = sub.failed_attempts + 1;
  const release = (patch: Record<string, unknown>) =>
    supabaseAdmin
      .from("mmpay_subscriptions")
      .update({ ...patch, locked_until: null, updated_at: new Date().toISOString() } as never)
      .eq("id", sub.id);

  // Cancelada ou concluída entretanto? Nunca cobrar.
  if (sub.status !== "active" && sub.status !== "past_due") {
    await release({});
    return "skipped";
  }
  if (!sub.viva_initial_transaction_id) {
    await release({ status: "past_due", next_charge_at: null });
    return "failed";
  }

  // Valor deste ciclo: com total + prestações, cada ciclo cobra a sua fatia exata
  // (os cêntimos que sobram da divisão ficam nas primeiras prestações).
  const cycleCents =
    sub.total_amount_cents && sub.total_cycles
      ? splitInstallments(sub.total_amount_cents, sub.total_cycles)[cycle - 1] ?? sub.amount_cents
      : sub.amount_cents;

  // Reserva o ciclo antes de falar com a Viva. Se já há cobrança paga/em curso, não repete.
  const { data: charge, error: claimErr } = await supabaseAdmin
    .from("mmpay_subscription_charges")
    .insert({ subscription_id: sub.id, cycle_number: cycle, attempt, amount_cents: cycleCents, status: "processing" })
    .select("id")
    .single();
  if (claimErr) {
    await release({});
    return "skipped";
  }

  const { chargeVivaRecurring } = await import("./viva.server");
  const res = await chargeVivaRecurring({
    initialTransactionId: sub.viva_initial_transaction_id,
    amountCents: cycleCents,
    description: `${sub.product_title} — cobrança ${cycle}`,
  });
  const now = new Date();

  if (res.ok) {
    await supabaseAdmin
      .from("mmpay_subscription_charges")
      .update({ status: "paid", viva_transaction_id: res.transactionId, finished_at: now.toISOString() })
      .eq("id", charge.id);
    const next = afterPaidCharge({
      chargesDone: cycle,
      totalCycles: sub.total_cycles,
      interval: sub.billing_interval as BillingInterval,
      intervalCount: sub.billing_interval_count,
      anchor: sub.next_charge_at ? new Date(sub.next_charge_at) : now,
    });
    await release({
      charges_count: cycle,
      failed_attempts: 0,
      status: next.status,
      last_charge_at: now.toISOString(),
      next_charge_at: next.nextChargeAt?.toISOString() ?? null,
      completed_at: next.status === "completed" ? now.toISOString() : null,
    });
    return "paid";
  }

  await supabaseAdmin
    .from("mmpay_subscription_charges")
    .update({ status: "failed", error: res.error, finished_at: now.toISOString() })
    .eq("id", charge.id);
  const retry = afterFailedCharge(attempt, now);
  await release({ status: "past_due", failed_attempts: attempt, next_charge_at: retry.nextChargeAt?.toISOString() ?? null });
  return "failed";
}

/** Executado pelo agendador: cobra as assinaturas vencidas. */
export async function runDueSubscriptionCharges(limit = 20) {
  const { data, error } = await supabaseAdmin.rpc("mmpay_claim_due_subscriptions", { _limit: limit });
  if (error) throw new Error(error.message);
  const out = { paid: 0, failed: 0, skipped: 0 };
  for (const sub of (data ?? []) as SubRow[]) out[await chargeOne(sub)]++;
  return out;
}

export async function listSubscriptions() {
  const { data, error } = await supabaseAdmin
    .from("mmpay_subscriptions")
    .select("id,product_title,customer_email,customer_name,customer_phone,amount_cents,currency,billing_interval,billing_interval_count,total_cycles,total_amount_cents,charges_count,status,started_at,next_charge_at,last_charge_at,completed_at,cancelled_at,cancel_reason")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listSubscriptionCharges(subscriptionId: string) {
  const { data, error } = await supabaseAdmin
    .from("mmpay_subscription_charges")
    .select("id,cycle_number,attempt,amount_cents,status,viva_transaction_id,error,created_at,finished_at")
    .eq("subscription_id", subscriptionId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Cancela: sem cobranças futuras; o histórico financeiro fica intacto. */
export async function cancelSubscription(id: string, reason: string | null) {
  const { data, error } = await supabaseAdmin
    .from("mmpay_subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: reason, next_charge_at: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["pending", "active", "past_due"])
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Esta assinatura já não está ativa.");
}
