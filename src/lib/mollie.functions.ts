import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CREDIT_PACKS } from "@/lib/studio-credit-packs";

/**
 * Create a Mollie payment for a credit pack and return the hosted checkout URL.
 * The pack is looked up server-side by id — client only sends the id, never the amount.
 */
export const createMollieCreditOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { packId: string; origin: string }) => {
    if (!data?.packId || typeof data.packId !== "string") {
      throw new Error("packId is required");
    }
    if (!data?.origin || !/^https?:\/\//.test(data.origin)) {
      throw new Error("origin is required");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const pack = CREDIT_PACKS.find((p) => p.id === data.packId);
    if (!pack) throw new Error("Unknown pack");

    const { createMolliePayment } = await import("@/lib/mollie.server");
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Prefer email from auth user
    const { data: userRes } = await supabase.auth.getUser();
    const email = userRes.user?.email ?? undefined;

    const origin = data.origin.replace(/\/$/, "");
    const redirectUrl = `${origin}/ferramentas/studio?topup=success`;
    // Public URL used by Mollie for the server-to-server callback.
    const webhookUrl = `${origin}/api/public/payments/mollie-webhook`;

    const payment = await createMolliePayment({
      amountEUR: pack.amountEUR,
      description: `MM Studio — ${pack.name} (${pack.credits} créditos)`,
      redirectUrl,
      webhookUrl,
      customerEmail: email,
      metadata: {
        userId,
        packId: pack.id,
        credits: pack.credits,
      },
    });

    await supabaseAdmin.from("mm_credit_orders").insert({
      user_id: userId,
      provider: "mollie",
      provider_payment_id: payment.id,
      pack_id: pack.id,
      credits: pack.credits,
      amount_eur: pack.amountEUR,
      status: payment.status,
    });

    const checkoutUrl = payment._links?.checkout?.href;
    if (!checkoutUrl) throw new Error("Mollie did not return a checkout URL");

    return {
      paymentId: payment.id,
      checkoutUrl,
      credits: pack.credits,
    };
  });

/**
 * VIP plan config — first payment creates the mandate, subscription starts
 * after the 3-month trial. Test mode uses €1 so live-adjacent flow can be
 * exercised without real charges. Change amounts here when going live.
 */
export const MOLLIE_VIP_PLAN = {
  id: "mm_club_vip_monthly",
  name: "MM Club — VIP (3 meses grátis)",
  firstPaymentEUR: 1.0,
  recurringEUR: 1.0,
  interval: "1 month" as const,
  trialDays: 90,
};

export const createMollieVipSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { origin: string }) => {
    if (!data?.origin || !/^https?:\/\//.test(data.origin)) {
      throw new Error("origin is required");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { createMollieCustomer, createMollieFirstPayment } = await import(
      "@/lib/mollie.server"
    );
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: userRes } = await supabase.auth.getUser();
    const email = userRes.user?.email ?? undefined;
    const name =
      (userRes.user?.user_metadata?.full_name as string | undefined) ??
      (userRes.user?.user_metadata?.name as string | undefined);

    const customer = await createMollieCustomer({
      email,
      name,
      metadata: { userId },
    });

    const origin = data.origin.replace(/\/$/, "");
    const redirectUrl = `${origin}/vip?vip=success`;
    const webhookUrl = `${origin}/api/public/payments/mollie-webhook`;

    const trialEndsAt = new Date(
      Date.now() + MOLLIE_VIP_PLAN.trialDays * 24 * 60 * 60 * 1000,
    );
    const startDate = trialEndsAt.toISOString().slice(0, 10);

    const payment = await createMollieFirstPayment({
      customerId: customer.id,
      amountEUR: MOLLIE_VIP_PLAN.firstPaymentEUR,
      description: `${MOLLIE_VIP_PLAN.name} — ativação do plano`,
      redirectUrl,
      webhookUrl,
      metadata: {
        kind: "vip_first",
        userId,
        planId: MOLLIE_VIP_PLAN.id,
        recurringEUR: MOLLIE_VIP_PLAN.recurringEUR,
        interval: MOLLIE_VIP_PLAN.interval,
        startDate,
      },
    });

    await supabaseAdmin.from("mm_mollie_subscriptions").insert({
      user_id: userId,
      mollie_customer_id: customer.id,
      first_payment_id: payment.id,
      plan_id: MOLLIE_VIP_PLAN.id,
      status: payment.status,
      amount_eur: MOLLIE_VIP_PLAN.recurringEUR,
      interval: MOLLIE_VIP_PLAN.interval,
      trial_ends_at: trialEndsAt.toISOString(),
      starts_at: trialEndsAt.toISOString(),
    });

    const checkoutUrl = payment._links?.checkout?.href;
    if (!checkoutUrl) throw new Error("Mollie did not return a checkout URL");

    return { paymentId: payment.id, checkoutUrl };
  });
