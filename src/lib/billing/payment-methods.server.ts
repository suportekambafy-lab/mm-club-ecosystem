/**
 * Payment methods (mandates) — self-service management for members.
 * Kept out of `commands.server.ts` so the checkout domain stays focused.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEFAULT_GATEWAY, getGateway } from "./gateway/index.server";
import { ensureCustomer } from "./commands.server";

/** Amount charged (and immediately refunded) to collect a reusable mandate. */
const VERIFICATION_CENTS = 1;

async function getCustomer(userId: string) {
  const { data } = await supabaseAdmin
    .from("billing_customers")
    .select("id, gateway_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

/** Mirrors the gateway mandates into `billing_payment_methods`. */
export async function syncPaymentMethods(userId: string): Promise<void> {
  const customer = await getCustomer(userId);
  if (!customer?.gateway_customer_id) return;

  const gw = getGateway(DEFAULT_GATEWAY);
  const mandates = await gw
    .listMandates(customer.gateway_customer_id)
    .catch(() => []);

  const { data: rows } = await supabaseAdmin
    .from("billing_payment_methods")
    .select("id, gateway_mandate_id, status, is_default")
    .eq("user_id", userId);

  const known = new Map(
    (rows ?? []).map((r) => [r.gateway_mandate_id ?? "", r] as const),
  );
  const hasDefault = (rows ?? []).some(
    (r) => r.is_default && r.status !== "revoked",
  );

  let first = true;
  for (const m of mandates) {
    const existing = known.get(m.id);
    if (existing) {
      await supabaseAdmin
        .from("billing_payment_methods")
        .update({
          method: m.method,
          brand: m.brand,
          last4: m.last4,
          status: "active",
        })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("billing_payment_methods").insert({
        customer_id: customer.id,
        user_id: userId,
        gateway: gw.name,
        gateway_mandate_id: m.id,
        method: m.method,
        brand: m.brand,
        last4: m.last4,
        is_default: !hasDefault && first,
        status: "active",
      });
    }
    first = false;
  }

  // Anything we know about that the gateway no longer reports is gone.
  const live = new Set(mandates.map((m) => m.id));
  for (const r of rows ?? []) {
    if (r.gateway_mandate_id && !live.has(r.gateway_mandate_id) && r.status !== "revoked") {
      await supabaseAdmin
        .from("billing_payment_methods")
        .update({ status: "revoked", is_default: false })
        .eq("id", r.id);
    }
  }
}

/**
 * Starts a hosted flow that stores a new card/method for the member.
 * Uses a 0,01 € verification charge (the gateway requires a real payment to
 * create a reusable mandate).
 */
export async function startAddPaymentMethod(input: {
  userId: string;
  email?: string | null;
  origin: string;
  returnPath?: string;
}): Promise<{ checkoutUrl: string }> {
  const origin = input.origin.replace(/\/$/, "");
  const customer = await ensureCustomer({
    userId: input.userId,
    email: input.email,
  });
  if (!customer.gatewayCustomerId) {
    throw new Error("Não foi possível criar o cliente no gateway.");
  }

  const gw = getGateway(DEFAULT_GATEWAY);
  const payment = await gw.createCharge({
    amountCents: VERIFICATION_CENTS,
    currency: "EUR",
    description: "MM Club — verificação do método de pagamento",
    redirectUrl: `${origin}${input.returnPath ?? "/subscricao?pm=added"}`,
    webhookUrl: `${origin}/api/public/payments/gateway-webhook`,
    customerId: customer.gatewayCustomerId,
    customerEmail: input.email,
    setupRecurring: true,
    metadata: {
      userId: input.userId,
      purpose: "add_payment_method",
      origin,
    },
  });

  if (!payment.checkoutUrl) throw new Error("Gateway sem URL de checkout");
  return { checkoutUrl: payment.checkoutUrl };
}

export async function setDefaultPaymentMethod(input: {
  userId: string;
  paymentMethodId: string;
}): Promise<void> {
  const { data: pm } = await supabaseAdmin
    .from("billing_payment_methods")
    .select("id")
    .eq("id", input.paymentMethodId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!pm) throw new Error("Método de pagamento não encontrado");

  await supabaseAdmin
    .from("billing_payment_methods")
    .update({ is_default: false })
    .eq("user_id", input.userId);
  await supabaseAdmin
    .from("billing_payment_methods")
    .update({ is_default: true, status: "active" })
    .eq("id", pm.id);
}

export async function removePaymentMethod(input: {
  userId: string;
  paymentMethodId: string;
}): Promise<void> {
  const { data: pm } = await supabaseAdmin
    .from("billing_payment_methods")
    .select("id, gateway_mandate_id, is_default")
    .eq("id", input.paymentMethodId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!pm) throw new Error("Método de pagamento não encontrado");

  const customer = await getCustomer(input.userId);
  if (pm.gateway_mandate_id && customer?.gateway_customer_id) {
    const { mollieFetch } = await import("@/lib/mollie.server");
    await mollieFetch(
      `/customers/${encodeURIComponent(customer.gateway_customer_id)}/mandates/${encodeURIComponent(pm.gateway_mandate_id)}`,
      { method: "DELETE" },
    ).catch((e) => console.error("[removePaymentMethod]", e));
  }

  await supabaseAdmin
    .from("billing_payment_methods")
    .update({ status: "revoked", is_default: false })
    .eq("id", pm.id);

  if (pm.is_default) {
    const { data: next } = await supabaseAdmin
      .from("billing_payment_methods")
      .select("id")
      .eq("user_id", input.userId)
      .neq("status", "revoked")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (next) {
      await supabaseAdmin
        .from("billing_payment_methods")
        .update({ is_default: true })
        .eq("id", next.id);
    }
  }
}
