/**
 * Billing Engine — commands.
 * This module is the ONLY entry point into the billing domain.
 * Web server functions, the public API and the admin backoffice all call
 * these same commands. No UI, no framework, no gateway specifics here.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { gatewayInterval, getPriceById, getPriceBySlug } from "./catalog.server";
import { emitEvent } from "./events.server";
import { DEFAULT_GATEWAY, getGateway } from "./gateway/index.server";
import type { GatewayPayment } from "./gateway/types";
import { recordLedgerEntry } from "./ledger.server";
import { assertTransition } from "./state-machine";
import type { SubscriptionStatus } from "./types";

// ---------------------------------------------------------------- customers

export async function ensureCustomer(input: {
  userId: string;
  email?: string | null;
  name?: string | null;
}): Promise<{ id: string; gatewayCustomerId: string | null }> {
  const { data: existing } = await supabaseAdmin
    .from("billing_customers")
    .select("id, gateway_customer_id")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (existing?.gateway_customer_id) {
    return { id: existing.id, gatewayCustomerId: existing.gateway_customer_id };
  }

  const gw = getGateway();
  const gwCustomer = await gw.createCustomer({
    email: input.email,
    name: input.name,
    metadata: { userId: input.userId },
  });

  if (existing) {
    await supabaseAdmin
      .from("billing_customers")
      .update({ gateway: gw.name, gateway_customer_id: gwCustomer.id })
      .eq("id", existing.id);
    return { id: existing.id, gatewayCustomerId: gwCustomer.id };
  }

  const { data, error } = await supabaseAdmin
    .from("billing_customers")
    .insert({
      user_id: input.userId,
      email: input.email ?? null,
      name: input.name ?? null,
      gateway: gw.name,
      gateway_customer_id: gwCustomer.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, gatewayCustomerId: gwCustomer.id };
}

// ----------------------------------------------------------------- checkout

export type StartCheckoutInput = {
  userId: string;
  email?: string | null;
  /** Either a price slug (stable, used by clients) or a price id. */
  priceSlug?: string;
  priceId?: string;
  origin: string;
  successPath?: string;
  couponCode?: string | null;
};

export async function startCheckout(input: StartCheckoutInput): Promise<{
  checkoutUrl: string;
  paymentId: string;
}> {
  const price = input.priceId
    ? await getPriceById(input.priceId)
    : input.priceSlug
      ? await getPriceBySlug(input.priceSlug)
      : null;
  if (!price) throw new Error("Unknown price");

  // Recovery before new revenue: settle any open debt first.
  try {
    const { triggerRecoveryNow } = await import("./recovery/engine.server");
    await triggerRecoveryNow(input.userId, "before_checkout");
  } catch (err) {
    console.error("[recovery] trigger before checkout", err);
  }



  const origin = input.origin.replace(/\/$/, "");
  const customer = await ensureCustomer({
    userId: input.userId,
    email: input.email,
  });

  const gw = getGateway();
  const recurring = price.interval !== "one_time" && price.interval !== "lifetime";
  const successPath =
    input.successPath ??
    (price.product.kind === "credit_pack"
      ? "/ferramentas/studio?topup=success"
      : "/dashboard?checkout=success");

  const payment = await gw.createCharge({
    // Trial prices only validate the card: charge the smallest amount possible.
    amountCents: price.trialDays > 0 ? 1 : price.amountCents,
    currency: price.currency,
    description: `MM Club — ${price.product.name}`,
    redirectUrl: `${origin}${successPath}`,
    webhookUrl: `${origin}/api/public/payments/gateway-webhook`,
    customerId: customer.gatewayCustomerId,
    customerEmail: input.email,
    setupRecurring: recurring,
    metadata: {
      userId: input.userId,
      priceId: price.id,
      priceSlug: price.slug,
      productId: price.product.id,
      kind: price.product.kind,
      recurring,
      origin,
    },
  });

  await supabaseAdmin.from("billing_payments").insert({
    customer_id: customer.id,
    user_id: input.userId,
    price_id: price.id,
    gateway: gw.name,
    gateway_payment_id: payment.id,
    status: payment.status,
    amount_cents: price.trialDays > 0 ? 1 : price.amountCents,
    currency: price.currency,
    metadata: { priceSlug: price.slug, recurring } as never,
  });

  if (!payment.checkoutUrl) throw new Error("Gateway returned no checkout URL");
  return { checkoutUrl: payment.checkoutUrl, paymentId: payment.id };
}

// ------------------------------------------------------- gateway reconcile

/**
 * Single reconciliation point for anything the gateway tells us about a
 * payment. Idempotent: safe to call repeatedly for the same payment.
 */
export async function handleGatewayPayment(
  gatewayName: string,
  gatewayPaymentId: string,
): Promise<void> {
  const gw = getGateway(gatewayName);
  const payment = await gw.getPayment(gatewayPaymentId);

  const { data: existing } = await supabaseAdmin
    .from("billing_payments")
    .select("*")
    .eq("gateway", gw.name)
    .eq("gateway_payment_id", payment.id)
    .maybeSingle();

  const meta = payment.metadata ?? {};
  let userId =
    (meta.userId as string | undefined) ?? existing?.user_id ?? null;

  // Card-verification charge used to store a new payment method: no order,
  // no entitlements — just refresh the stored mandates.
  if (meta.purpose === "add_payment_method") {
    if (userId && payment.status === "paid") {
      const { syncPaymentMethods } = await import("./payment-methods.server");
      await syncPaymentMethods(userId);
    }
    return;
  }


  // Guest checkout: the account only exists once the payment is confirmed.
  if (!userId && meta.intentId) {
    if (payment.status !== "paid") return;
    const { provisionAccountForIntent } = await import("./guest.server");
    userId = await provisionAccountForIntent(
      String(meta.intentId),
      gw.name,
      payment.id,
    );
  }
  if (!userId) return;


  let priceId = (meta.priceId as string | undefined) ?? existing?.price_id ?? null;
  let subscriptionId = existing?.subscription_id ?? null;

  // Recurring cycle payments arrive attached to a gateway subscription.
  if (!subscriptionId && payment.subscriptionId) {
    const { data: sub } = await supabaseAdmin
      .from("billing_subscriptions")
      .select("id, price_id")
      .eq("gateway_subscription_id", payment.subscriptionId)
      .maybeSingle();
    if (sub) {
      subscriptionId = sub.id;
      priceId = priceId ?? sub.price_id;
    }
  }

  const { data: customer } = await supabaseAdmin
    .from("billing_customers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  const row = {
    customer_id: customer?.id ?? null,
    user_id: userId,
    subscription_id: subscriptionId,
    price_id: priceId,
    gateway: gw.name,
    gateway_payment_id: payment.id,
    status: payment.status,
    amount_cents: payment.amountCents,
    refunded_cents: payment.refundedCents,
    currency: payment.currency,
    method: payment.method,
    failure_reason: payment.failureReason,
    paid_at: payment.paidAt,
    metadata: meta as never,
  };

  const { data: saved } = await supabaseAdmin
    .from("billing_payments")
    .upsert(row, { onConflict: "gateway,gateway_payment_id" })
    .select("id")
    .maybeSingle();

  const paymentRowId = saved?.id ?? existing?.id ?? null;
  const alreadyPaid = existing?.status === "paid";

  const { resolveRecoveryForPayment, startRecovery, cancelRecoveryForSubscription } =
    await import("./recovery/engine.server");

  if (payment.status === "paid" && !alreadyPaid) {
    // Whatever card the member just used becomes a saved method, so it can be
    // reused for future charges (credit packs, renewals, retries…).
    if (payment.customerId) {
      try {
        const { syncPaymentMethods } = await import("./payment-methods.server");
        await syncPaymentMethods(userId);
      } catch (err) {
        console.error("[billing] syncPaymentMethods after payment", err);
      }
    }
    await onPaymentPaid({ payment, userId, priceId, paymentRowId, customerId: customer?.id ?? null, subscriptionId });
    await resolveRecoveryForPayment({
      gatewayPaymentId: payment.id,
      outcome: "paid",
      paidCents: payment.amountCents,
      paymentRowId,
    });
    // Revenue Intelligence: every successful payment teaches the profile.
    try {
      const { refreshCustomerProfile } = await import("./recovery/profile.server");
      await refreshCustomerProfile(userId, "payment_succeeded");
    } catch (err) {
      console.error("[billing] refreshCustomerProfile", err);
    }

  } else if (payment.status === "failed" || payment.status === "expired") {
    await emitEvent({
      type: "PaymentFailed",
      aggregateType: "payment",
      aggregateId: paymentRowId,
      idempotencyKey: `payment_failed:${payment.id}`,
      payload: {
        userId,
        amountCents: payment.amountCents,
        currency: payment.currency,
        reason: payment.failureReason,
        subscriptionId,
      },
    });
    if (subscriptionId) {
      // Is this failure part of an existing recovery plan, or a brand new one?
      const cycle = (payment.metadata?.recoveryCycle as string | undefined) ?? null;
      if (cycle) {
        await resolveRecoveryForPayment({
          gatewayPaymentId: payment.id,
          outcome: "failed",
          failureReason: payment.failureReason,
          paymentRowId,
        });
      } else {
        await markPastDue(subscriptionId, userId);
        await startRecovery({
          subscriptionId,
          userId,
          amountCents: payment.amountCents,
          currency: payment.currency,
          failureReason: payment.failureReason,
          gatewayPaymentId: payment.id,
          method: payment.method,
        });
      }
    }
  } else if (payment.refundedCents > 0) {
    await onRefund({ payment, userId, paymentRowId, customerId: customer?.id ?? null, subscriptionId });
    await resolveRecoveryForPayment({
      gatewayPaymentId: payment.id,
      outcome: "refunded",
      paymentRowId,
    });
    if (subscriptionId) {
      await cancelRecoveryForSubscription(subscriptionId, "refunded");
    }
  }
}


async function onPaymentPaid(args: {
  payment: GatewayPayment;
  userId: string;
  priceId: string | null;
  paymentRowId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
}) {
  const { payment, userId, priceId, paymentRowId, customerId } = args;
  let subscriptionId = args.subscriptionId;

  const eventId = await emitEvent({
    type: "PaymentSucceeded",
    aggregateType: "payment",
    aggregateId: paymentRowId,
    idempotencyKey: `payment_paid:${payment.id}`,
    payload: {
      userId,
      amountCents: payment.amountCents,
      currency: payment.currency,
      priceId,
    },
  });

  await recordLedgerEntry({
    userId,
    customerId,
    entryType: "payment",
    direction: "credit",
    amountCents: payment.amountCents,
    currency: payment.currency,
    sourceType: "payment",
    sourceId: paymentRowId,
    eventId,
    idempotencyKey: `payment:${payment.id}`,
    memo: "Pagamento recebido",
  });

  // Every paid payment gets its own invoice document.
  if (paymentRowId) {
    try {
      const { ensureInvoiceForPayment } = await import("./invoices.server");
      await ensureInvoiceForPayment(paymentRowId);
    } catch (err) {
      console.error("[billing] invoice generation", err);
    }
  }

  const price = priceId ? await getPriceById(priceId) : null;
  if (!price) return;

  const recurring = price.interval !== "one_time" && price.interval !== "lifetime";

  if (recurring) {
    if (subscriptionId) {
      await renewPeriod(subscriptionId, userId, price.interval, price.intervalCount);
    } else {
      subscriptionId = await activateSubscription({
        userId,
        customerId,
        payment,
        priceId: price.id,
        productId: price.product.id,
        interval: price.interval,
        intervalCount: price.intervalCount,
        gatewayIntervalStr: gatewayInterval(price),
        amountCents: price.amountCents,
        trialDays: price.trialDays,
        currency: price.currency,
        description: `MM Club — ${price.product.name}`,
      });
    }
    return;
  }

  // One-off purchase (credit pack, course, event, certificate…)
  await emitEvent({
    type: "ProductPurchased",
    aggregateType: "payment",
    aggregateId: paymentRowId,
    idempotencyKey: `purchased:${payment.id}`,
    payload: {
      userId,
      productId: price.product.id,
      productName: price.product.name,
      productKind: price.product.kind,
      priceId: price.id,
      grantsCredits: price.grantsCredits,
      amountCents: payment.amountCents,
      currency: payment.currency,
      paymentId: payment.id,
    },
  });
}

function periodEnd(from: Date, interval: string, count: number): Date {
  const d = new Date(from);
  if (interval === "day") d.setDate(d.getDate() + count);
  else if (interval === "week") d.setDate(d.getDate() + 7 * count);
  else if (interval === "month") d.setMonth(d.getMonth() + count);
  else if (interval === "year") d.setFullYear(d.getFullYear() + count);
  return d;
}

async function activateSubscription(args: {
  userId: string;
  customerId: string | null;
  payment: GatewayPayment;
  priceId: string;
  productId: string;
  interval: string;
  intervalCount: number;
  gatewayIntervalStr: string;
  amountCents: number;
  currency: string;
  description: string;
}): Promise<string> {
  const gw = getGateway();
  const start = new Date();
  const end = periodEnd(start, args.interval, args.intervalCount);

  // Store the mandate as a reusable payment method.
  let paymentMethodId: string | null = null;
  if (args.payment.mandateId && args.customerId) {
    const mandates = args.payment.customerId
      ? await gw.listMandates(args.payment.customerId)
      : [];
    const m = mandates.find((x) => x.id === args.payment.mandateId);
    const { data: pm } = await supabaseAdmin
      .from("billing_payment_methods")
      .upsert(
        {
          customer_id: args.customerId,
          user_id: args.userId,
          gateway: gw.name,
          gateway_mandate_id: args.payment.mandateId,
          method: m?.method ?? args.payment.method,
          brand: m?.brand ?? null,
          last4: m?.last4 ?? null,
          is_default: true,
          status: "active",
        },
        { onConflict: "user_id,gateway_mandate_id" },
      )
      .select("id")
      .maybeSingle();

    paymentMethodId = pm?.id ?? null;
  }

  // Ask the gateway to charge the following cycles automatically.
  let gatewaySubscriptionId: string | null = null;
  if (args.payment.customerId && args.payment.mandateId) {
    const gwSub = await gw.createSubscription({
      customerId: args.payment.customerId,
      mandateId: args.payment.mandateId,
      amountCents: args.amountCents,
      currency: args.currency,
      interval: args.gatewayIntervalStr,
      description: args.description,
      webhookUrl: `${(args.payment.metadata.origin as string) ?? ""}/api/public/payments/gateway-webhook`,
      startDate: end.toISOString().slice(0, 10),
      metadata: { userId: args.userId, priceId: args.priceId },
    });
    gatewaySubscriptionId = gwSub.id;
  }

  const { data: sub, error } = await supabaseAdmin
    .from("billing_subscriptions")
    .insert({
      customer_id: args.customerId!,
      user_id: args.userId,
      product_id: args.productId,
      price_id: args.priceId,
      status: "active",
      gateway: gw.name,
      gateway_subscription_id: gatewaySubscriptionId,
      payment_method_id: paymentMethodId,
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from("billing_payments")
    .update({ subscription_id: sub.id })
    .eq("gateway", gw.name)
    .eq("gateway_payment_id", args.payment.id);

  await emitEvent({
    type: "SubscriptionActivated",
    aggregateType: "subscription",
    aggregateId: sub.id,
    idempotencyKey: `sub_activated:${sub.id}`,
    payload: {
      userId: args.userId,
      subscriptionId: sub.id,
      productId: args.productId,
      priceId: args.priceId,
      currentPeriodEnd: end.toISOString(),
    },
  });

  return sub.id;
}

async function renewPeriod(
  subscriptionId: string,
  userId: string,
  interval: string,
  intervalCount: number,
) {
  const { data: sub } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("status, current_period_end")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!sub) return;

  const base = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
  const start = base > new Date() ? base : new Date();
  const end = periodEnd(start, interval, intervalCount);
  const wasStruggling = sub.status !== "active";

  await supabaseAdmin
    .from("billing_subscriptions")
    .update({
      status: "active",
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
    })
    .eq("id", subscriptionId);

  if (wasStruggling) {
    await emitEvent({
      type: "PaymentRecovered",
      aggregateType: "subscription",
      aggregateId: subscriptionId,
      payload: { userId, subscriptionId },
    });
  }
}

async function markPastDue(subscriptionId: string, userId: string) {
  const { data: sub } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("status")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!sub) return;
  const from = sub.status as SubscriptionStatus;
  if (from === "past_due" || from === "cancelled" || from === "expired") return;
  assertTransition(from, "past_due");
  await supabaseAdmin
    .from("billing_subscriptions")
    .update({ status: "past_due" })
    .eq("id", subscriptionId);
  await emitEvent({
    type: "DunningEscalated",
    aggregateType: "subscription",
    aggregateId: subscriptionId,
    payload: { userId, subscriptionId, stage: "past_due" },
  });
}

async function onRefund(args: {
  payment: GatewayPayment;
  userId: string;
  paymentRowId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
}) {
  const eventId = await emitEvent({
    type: "PaymentRefunded",
    aggregateType: "payment",
    aggregateId: args.paymentRowId,
    idempotencyKey: `refund:${args.payment.id}:${args.payment.refundedCents}`,
    payload: {
      userId: args.userId,
      amountCents: args.payment.refundedCents,
      currency: args.payment.currency,
      subscriptionId: args.subscriptionId,
    },
  });
  await recordLedgerEntry({
    userId: args.userId,
    customerId: args.customerId,
    entryType: "refund",
    direction: "debit",
    amountCents: args.payment.refundedCents,
    currency: args.payment.currency,
    sourceType: "payment",
    sourceId: args.paymentRowId,
    eventId,
    idempotencyKey: `refund:${args.payment.id}:${args.payment.refundedCents}`,
    memo: "Reembolso",
  });
}

// ------------------------------------------------------------ subscriptions

export async function cancelSubscription(input: {
  subscriptionId: string;
  userId: string;
  immediate?: boolean;
  actorId?: string | null;
  reason?: string | null;
}): Promise<void> {
  const { data: sub } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("*, customer:billing_customers(gateway_customer_id)")
    .eq("id", input.subscriptionId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!sub) throw new Error("Subscription not found");

  const gw = getGateway(sub.gateway ?? DEFAULT_GATEWAY);
  const gwCustomerId = (
    sub as unknown as { customer?: { gateway_customer_id?: string | null } }
  ).customer?.gateway_customer_id;

  if (sub.gateway_subscription_id && gwCustomerId) {
    await gw
      .cancelSubscription(gwCustomerId, sub.gateway_subscription_id)
      .catch((e) => console.error("gateway cancel failed", e));
  }

  const now = new Date().toISOString();
  if (input.immediate) {
    assertTransition(sub.status as SubscriptionStatus, "cancelled");
    await supabaseAdmin
      .from("billing_subscriptions")
      .update({ status: "cancelled", cancelled_at: now, ended_at: now, cancel_at_period_end: false })
      .eq("id", sub.id);
  } else {
    await supabaseAdmin
      .from("billing_subscriptions")
      .update({ cancel_at_period_end: true, cancelled_at: now })
      .eq("id", sub.id);
  }

  await supabaseAdmin.from("audit_log").insert({
    actor_id: input.actorId ?? input.userId,
    action: input.immediate ? "subscription.cancel_immediate" : "subscription.cancel_at_period_end",
    entity_type: "billing_subscription",
    entity_id: sub.id,
    before: { status: sub.status, cancel_at_period_end: sub.cancel_at_period_end } as never,
    after: { status: input.immediate ? "cancelled" : sub.status, cancel_at_period_end: !input.immediate } as never,
    reason: input.reason ?? null,
  });

  await emitEvent({
    type: "SubscriptionCancelled",
    aggregateType: "subscription",
    aggregateId: sub.id,
    actorId: input.actorId ?? input.userId,
    payload: {
      userId: input.userId,
      subscriptionId: sub.id,
      immediate: Boolean(input.immediate),
      endsAt: input.immediate ? now : sub.current_period_end,
    },
  });
}

export async function resumeSubscription(input: {
  subscriptionId: string;
  userId: string;
}): Promise<void> {
  const { data: sub } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("id, status, cancel_at_period_end")
    .eq("id", input.subscriptionId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!sub) throw new Error("Subscription not found");
  if (!sub.cancel_at_period_end) return;

  await supabaseAdmin
    .from("billing_subscriptions")
    .update({ cancel_at_period_end: false, cancelled_at: null })
    .eq("id", sub.id);

  await emitEvent({
    type: "SubscriptionResumed",
    aggregateType: "subscription",
    aggregateId: sub.id,
    payload: { userId: input.userId, subscriptionId: sub.id },
  });
}

/** Admin/manual: grant credits or money adjustments straight into the ledger. */
export async function recordManualAdjustment(input: {
  userId: string;
  amountCents: number;
  direction: "debit" | "credit";
  memo: string;
  actorId: string;
}): Promise<void> {
  await recordLedgerEntry({
    userId: input.userId,
    entryType: "adjustment",
    direction: input.direction,
    amountCents: input.amountCents,
    sourceType: "manual",
    idempotencyKey: `manual:${input.userId}:${Date.now()}`,
    actorId: input.actorId,
    memo: input.memo,
  });
  await supabaseAdmin.from("audit_log").insert({
    actor_id: input.actorId,
    action: "ledger.manual_adjustment",
    entity_type: "user",
    entity_id: input.userId,
    after: { amountCents: input.amountCents, direction: input.direction } as never,
    reason: input.memo,
  });
}
