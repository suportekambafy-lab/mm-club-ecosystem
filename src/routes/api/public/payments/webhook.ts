import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { EventName, gatewayFetch, type PaddleEnv, verifyWebhook } from "@/lib/paddle.server";
import { packByPriceId } from "@/lib/studio-credit-packs";

/**
 * Resolve a Paddle price's human-readable external_id.
 * transaction.completed webhook payloads omit `import_meta` on the price
 * object, so we look it up via the API when it's missing.
 */
async function resolveExternalPriceId(
  item: any,
  env: PaddleEnv,
): Promise<string | undefined> {
  const inline = item?.price?.importMeta?.externalId as string | undefined;
  if (inline) return inline;
  const paddlePriceId = item?.price?.id as string | undefined;
  if (!paddlePriceId) return undefined;
  try {
    const res = await gatewayFetch(env, `/prices/${paddlePriceId}`);
    const body = await res.json();
    return body?.data?.import_meta?.external_id ?? undefined;
  } catch (e) {
    console.error("resolveExternalPriceId failed", { paddlePriceId, e });
    return undefined;
  }
}

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

/**
 * Resolve the app userId for a Paddle customer.
 * Prefers customData.userId from the checkout, then falls back to the
 * paddle_customers mirror. Never trusts anything unverified.
 */
async function resolveUserId(
  customerId: string,
  customData: unknown,
): Promise<string | null> {
  const inline = (customData as { userId?: unknown } | null)?.userId;
  if (typeof inline === "string" && inline.length) return inline;

  const { data } = await getSupabase()
    .from("paddle_customers")
    .select("user_id")
    .eq("paddle_customer_id", customerId)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

async function handleSubscriptionCreatedOrUpdated(
  data: any,
  env: PaddleEnv,
) {
  const userId = await resolveUserId(data.customerId, data.customData);
  if (!userId) {
    console.error("subscription webhook: no userId", { id: data.id });
    return;
  }

  const item = data.items?.[0];
  const priceExternal = item?.price?.importMeta?.externalId;
  const productExternal = item?.product?.importMeta?.externalId;
  if (!priceExternal || !productExternal) {
    console.warn("Skipping subscription: missing importMeta.externalId", {
      rawPriceId: item?.price?.id,
      rawProductId: item?.product?.id,
    });
    return;
  }

  const scheduledChange = data.scheduledChange ?? null;

  await getSupabase()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        paddle_subscription_id: data.id,
        paddle_customer_id: data.customerId,
        product_id: productExternal,
        price_id: priceExternal,
        status: data.status,
        current_period_start: data.currentBillingPeriod?.startsAt ?? null,
        current_period_end: data.currentBillingPeriod?.endsAt ?? null,
        cancel_at_period_end:
          scheduledChange?.action === "cancel" ? true : false,
        scheduled_change_action: scheduledChange?.action ?? null,
        scheduled_change_at: scheduledChange?.effectiveAt ?? null,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "paddle_subscription_id" },
    );
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env);
}

async function handleCustomer(data: any, env: PaddleEnv) {
  if (!data?.id || !data?.email) return;
  await getSupabase()
    .from("paddle_customers")
    .upsert(
      {
        paddle_customer_id: data.id,
        email: data.email,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "paddle_customer_id" },
    );
}

async function handleTransactionCompleted(data: any) {
  const userId = await resolveUserId(data.customerId, data.customData);
  if (!userId) {
    console.warn("transaction.completed: no userId", { id: data.id });
    return;
  }
  const items: any[] = Array.isArray(data.items) ? data.items : [];
  for (const item of items) {
    const priceExternal = item?.price?.importMeta?.externalId as string | undefined;
    const pack = packByPriceId(priceExternal);
    if (!pack) continue;
    const qty = Math.max(1, Number(item?.quantity) || 1);
    const amount = pack.credits * qty;
    const reason = `purchase:${data.id}:${pack.priceId}`;
    const { error } = await getSupabase().rpc("mm_studio_grant_credits", {
      _user_id: userId,
      _amount: amount,
      _reason: reason,
    });
    if (error) {
      console.error("grant_credits failed", { reason, error: error.message });
    } else {
      console.log("granted credits", { userId, amount, pack: pack.priceId, txn: data.id });
    }
  }
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.eventType) {
    case EventName.SubscriptionCreated:
    case EventName.SubscriptionUpdated:
    case EventName.SubscriptionActivated:
    case EventName.SubscriptionTrialing:
    case EventName.SubscriptionPaused:
    case EventName.SubscriptionResumed:
    case EventName.SubscriptionPastDue:
      await handleSubscriptionCreatedOrUpdated(event.data, env);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
      break;
    case EventName.CustomerCreated:
    case EventName.CustomerUpdated:
      await handleCustomer(event.data, env);
      break;
    case EventName.TransactionCompleted:
      await handleTransactionCompleted(event.data);
      break;
    default:
      console.log("Unhandled event:", event.eventType);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook received with invalid env:", rawEnv);
          return new Response("Invalid env", { status: 400 });
        }
        const env: PaddleEnv = rawEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Paddle webhook error:", e);
          // Non-2xx keeps Paddle retrying — required for signature failures
          // and transient errors.
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
