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

const APP_NAME = "MM Club";

/** Looks up an auth user by email (small user base — paged scan). */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
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
  | { status: "redirect"; checkoutUrl: string; intentId: string }
  | { status: "account_exists" };

export async function startGuestCheckout(
  input: StartGuestCheckoutInput,
): Promise<StartGuestCheckoutResult> {
  const email = input.email.trim().toLowerCase();
  const price = await getPriceBySlug(input.priceSlug);
  if (!price) throw new Error("Unknown price");

  // Already a member? They must sign in so the payment lands on their account.
  const existingUserId = await findUserIdByEmail(email);
  if (existingUserId) return { status: "account_exists" };

  const origin = input.origin.replace(/\/$/, "");

  const { data: intent, error } = await supabaseAdmin
    .from("billing_checkout_intents")
    .insert({
      email,
      name: input.name ?? null,
      price_id: price.id,
      coupon_code: input.couponCode ?? null,
      status: "pending",
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
        metadata: { gatewayCustomerId } as never,
      })
      .eq("id", intent.id);
  }

  const payment = await gw.createCharge({
    amountCents: price.amountCents,
    currency: price.currency,
    description: `${APP_NAME} — ${price.product.name}`,
    redirectUrl: `${origin}/checkout/return?intent=${intent.id}`,
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

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `Mm!${Array.from(bytes, (b) => b.toString(36)).join("")}`;
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

  if (!userId) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: {
        display_name: intent.name ?? email.split("@")[0],
      },
    });
    if (error || !data.user) {
      await supabaseAdmin
        .from("billing_checkout_intents")
        .update({ status: "failed", error: error?.message ?? "create_user_failed" })
        .eq("id", intent.id);
      throw new Error(error?.message ?? "create_user_failed");
    }
    userId = data.user.id;
    created = true;
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


  if (created) {
    await sendAccountReadyEmail(userId, email).catch((e) =>
      console.error("[guest checkout] welcome email", e),
    );
  }

  return userId;
}

async function sendAccountReadyEmail(userId: string, email: string) {
  const origin = "https://mmclub.online";
  let actionUrl = `${origin}/auth?mode=recover&email=${encodeURIComponent(email)}`;
  try {
    const { data } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${origin}/auth` },
    });
    if (data?.properties?.action_link) actionUrl = data.properties.action_link;
  } catch (e) {
    console.error("[guest checkout] generateLink", e);
  }

  const { sendEmail } = await import("@/lib/email.server");
  await sendEmail({
    to: email,
    userId,
    kind: "welcome",
    ref: `guest_checkout:${userId}`,
    subject: "A tua conta MM Club está pronta",
    html: `
      <div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0b0b0c">
        <h1 style="font-size:24px;margin:0 0 12px">Bem-vindo ao MM Club</h1>
        <p style="font-size:15px;line-height:1.6;color:#4a4a52">
          O teu pagamento foi confirmado e criámos a tua conta com o email
          <strong>${email}</strong>. Define a tua palavra-passe para entrares.
        </p>
        <p style="margin:28px 0">
          <a href="${actionUrl}" style="background:#0b0b0c;color:#fff;text-decoration:none;padding:14px 26px;border-radius:999px;font-size:14px;font-weight:600">
            Definir palavra-passe
          </a>
        </p>
        <p style="font-size:13px;color:#8a8a94">
          Se o botão não funcionar, abre ${origin}/auth e usa "Esqueci-me da palavra-passe".
        </p>
      </div>`,
  });
}
