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
