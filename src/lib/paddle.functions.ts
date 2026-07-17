import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  gatewayFetch,
  getPaddleClient,
  type PaddleEnv,
} from "@/lib/paddle.server";

/**
 * Resolve a human-readable price external_id (e.g. mm_club_start_monthly)
 * to a Paddle internal price id (pri_...) for the requested environment.
 */
export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { priceId: string; environment: PaddleEnv }) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) {
        throw new Error("Invalid priceId");
      }
      if (data.environment !== "sandbox" && data.environment !== "live") {
        throw new Error("Invalid environment");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    const response = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    if (!response.ok) {
      throw new Error(`Paddle API error: ${response.status}`);
    }
    const result = (await response.json()) as {
      data?: Array<{ id: string }>;
    };
    if (!result.data?.length) throw new Error("Price not found");
    return result.data[0].id;
  });

/**
 * Mint a Paddle-hosted customer portal session for the signed-in user.
 * Resolves the customer id from the DB (never trusts a client-supplied id).
 */
export const createCustomerPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Newest subscription first — same key the mirror uses.
    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select(
        "paddle_customer_id, paddle_subscription_id, environment, status, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!sub?.paddle_customer_id) {
      return { error: "no_customer" as const };
    }

    const env = (sub.environment as PaddleEnv) ?? "live";
    const paddle = getPaddleClient(env);

    const session = await paddle.customerPortalSessions.create(
      sub.paddle_customer_id,
      sub.paddle_subscription_id ? [sub.paddle_subscription_id] : [],
    );

    return {
      url: session.urls.general.overview,
      subscriptionUrls: session.urls.subscriptions,
    };
  });
