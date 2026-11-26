/**
 * Guest checkout ("pay first, account after").
 *
 * A visitor pays without an account. We keep the intent (email + price) in
 * `billing_checkout_intents`, and only when the gateway confirms the payment
 * do we provision the auth account and run the normal fulfilment path.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getPriceBySlug } from "./catalog.server";
import { getGateway } from "./gateway/index.server";
import { buildCheckoutDescription } from "./description";
import { TRIAL_VERIFICATION_CENTS } from "./types";


/** Looks up an auth user by email (direct filter, paged scan as fallback). */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();

  // Filtro direto: não depende de percorrer todas as páginas de utilizadores.
  try {
    const { data } = await (supabaseAdmin.auth.admin.listUsers as unknown as (
      p: Record<string, unknown>,
    ) => Promise<{ data: { users: { id: string; email?: string | null }[] } }>)({
      page: 1,
      perPage: 200,
      filter: `email.eq.${target}`,
    });
    const direct = data?.users?.find((u) => (u.email ?? "").toLowerCase() === target);
    if (direct) return direct.id;
  } catch {
    // Filtro não suportado — segue para a varredura paginada.
  }

  for (let page = 1; page <= 60; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

export type StartGuestCheckoutInput = {
  email: string;
  name?: string | null;
  priceSlug: string;
  origin: string;
  couponCode?: string | null;
};

export type StartGuestCheckoutResult =
  { status: "redirect"; checkoutUrl: string; intentId: string };

export async function startGuestCheckout(
  input: StartGuestCheckoutInput,
): Promise<StartGuestCheckoutResult> {
  const email = input.email.trim().toLowerCase();
  const price = await getPriceBySlug(input.priceSlug);
  if (!price) throw new Error("Unknown price");

  // Nunca bloqueamos o pagamento apenas porque o email já existe. Este é o
  // caso crítico: alguém pode ter ficado com uma conta criada num fluxo antigo
  // sem assinatura/palavra-passe. O checkout continua; após confirmação,
  // ligamos o pagamento à conta existente ou criamos uma nova se necessário.

  const origin = input.origin.replace(/\/$/, "");
  // Segredo de regresso: só quem volta do pagamento consegue ver o estado.
  const returnToken = crypto.randomUUID();

  const { data: intent, error } = await supabaseAdmin
    .from("billing_checkout_intents")
    .insert({
      email,
      name: input.name ?? null,
      price_id: price.id,
      coupon_code: input.couponCode ?? null,
      status: "pending",
      metadata: { returnToken } as never,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);


  const gw = getGateway();
  const recurring =
    price.interval !== "one_time" && price.interval !== "lifetime";

  // Recurring (first) payments require a gateway customer so the mandate can
  // be stored. Create it up front and keep it on the intent so the account we
  // provision later reuses the same customer (and therefore the mandate).
  let gatewayCustomerId: string | null = null;
  if (recurring) {
    const gwCustomer = await gw.createCustomer({
      email,
      name: input.name ?? null,
      metadata: { intentId: intent.id, guest: true },
    });
    gatewayCustomerId = gwCustomer.id;
    await supabaseAdmin
      .from("billing_checkout_intents")
      .update({
        metadata: { returnToken, gatewayCustomerId } as never,
      })
      .eq("id", intent.id);
  }

  const payment = await gw.createCharge({
    // Trial prices only create a mandate (1,00 € verification); the plan starts free.
    amountCents: price.trialDays > 0 ? TRIAL_VERIFICATION_CENTS : price.amountCents,
    currency: price.currency,
    description: buildCheckoutDescription(price),
    redirectUrl: `${origin}/checkout/return?intent=${intent.id}&token=${returnToken}`,
    webhookUrl: `${origin}/api/public/payments/gateway-webhook`,
    customerId: gatewayCustomerId,
    customerEmail: email,
    setupRecurring: recurring,
    metadata: {
      intentId: intent.id,
      guest: true,
      email,
      priceId: price.id,
      priceSlug: price.slug,
      productId: price.product.id,
      kind: price.product.kind,
      recurring,
      origin,
    },
  });


  await supabaseAdmin
    .from("billing_checkout_intents")
    .update({
      gateway: gw.name,
      gateway_payment_id: payment.id,
      status: "awaiting_payment",
    })
    .eq("id", intent.id);

  if (!payment.checkoutUrl) throw new Error("Gateway returned no checkout URL");
  return { status: "redirect", checkoutUrl: payment.checkoutUrl, intentId: intent.id };
}

/**
 * Creates (or resolves) the account behind a paid guest intent.
 * Idempotent: repeated calls return the same user id.
 */
export async function provisionAccountForIntent(
  intentId: string,
  gatewayName: string,
  gatewayPaymentId: string,
): Promise<string | null> {
  const { data: intent } = await supabaseAdmin
    .from("billing_checkout_intents")
    .select("id, email, name, user_id, account_created, metadata")
    .eq("id", intentId)
    .maybeSingle();
  if (!intent) return null;
  if (intent.user_id) return intent.user_id;


  const email = intent.email.trim().toLowerCase();
  let userId = await findUserIdByEmail(email);
  let created = false;
  let newPassword: string | null = null;

  if (!userId) {
    const { createMemberWithPassword } = await import("@/lib/member-onboarding.server");
    try {
      const account = await createMemberWithPassword(supabaseAdmin, email, intent.name);
      userId = account.id;
      newPassword = account.password;
      created = true;
    } catch (error) {
      // O email já pertence a uma conta (constraint de email duplicado ou
      // criação simultânea): ligamos o pagamento a essa conta em vez de
      // marcar o checkout como falhado e deixar o comprador sem acesso.
      const message = error instanceof Error ? error.message : "create_user_failed";
      const msg = message.toLowerCase();
      const duplicate =
        msg.includes("already") ||
        msg.includes("duplicate") ||
        msg.includes("registered") ||
        msg.includes("23505");
      const recovered = duplicate ? await findUserIdByEmail(email) : null;
      if (!recovered) {
        await supabaseAdmin
          .from("billing_checkout_intents")
          .update({ status: "failed", error: message })
          .eq("id", intent.id);
        throw new Error(message);
      }
      userId = recovered;
    }
  }

  // Reuse the gateway customer created at checkout so the mandate stays
  // attached to this member (needed for renewals).
  const gatewayCustomerId =
    (intent.metadata as { gatewayCustomerId?: string } | null)
      ?.gatewayCustomerId ?? null;
  if (gatewayCustomerId) {
    const { data: existingCustomer } = await supabaseAdmin
      .from("billing_customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existingCustomer) {
      await supabaseAdmin
        .from("billing_customers")
        .update({ gateway: gatewayName, gateway_customer_id: gatewayCustomerId })
        .eq("id", existingCustomer.id);
    } else {
      await supabaseAdmin.from("billing_customers").insert({
        user_id: userId,
        email,
        name: intent.name ?? null,
        gateway: gatewayName,
        gateway_customer_id: gatewayCustomerId,
      });
    }
  }

  await supabaseAdmin
    .from("billing_checkout_intents")
    .update({
      user_id: userId,
      account_created: created,
      status: "provisioned",
      gateway: gatewayName,
      gateway_payment_id: gatewayPaymentId,
    })
    .eq("id", intent.id);


  if (created && newPassword) {
    const { sendNewMemberAccess } = await import("@/lib/member-onboarding.server");
    await sendNewMemberAccess({ email, name: intent.name, password: newPassword, eventId: `intent-${intent.id}` }).catch(() =>
      console.error("[guest checkout] falha no envio do acesso", intent.id),
    );
  }


  return userId;
}

