/**
 * Consumer: entitlements.
 * Translates billing facts into access. Billing never grants access directly.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  grantProductFeatures,
  revokeBySource,
} from "@/lib/entitlements/grants.server";
import type { JobPayload } from "../types";

export async function entitlementsConsumer(job: JobPayload): Promise<void> {
  const userId = job.userId as string | undefined;
  if (!userId) return;

  switch (job.eventType) {
    case "SubscriptionActivated":
    case "SubscriptionRenewed":
    case "SubscriptionResumed":
    case "SubscriptionUpgraded":
    case "SubscriptionDowngraded":
    case "PaymentRecovered": {
      const subscriptionId = (job.subscriptionId ?? job.aggregateId) as
        | string
        | undefined;
      if (!subscriptionId) return;
      const { data: sub } = await supabaseAdmin
        .from("billing_subscriptions")
        .select("product_id, current_period_end")
        .eq("id", subscriptionId)
        .maybeSingle();
      if (!sub) return;
      await grantProductFeatures({
        userId,
        productId: sub.product_id,
        source: "subscription",
        sourceId: subscriptionId,
        // Grace: access survives a few days past the period end; dunning decides.
        expiresAt: sub.current_period_end
          ? new Date(
              new Date(sub.current_period_end).getTime() + 3 * 86400000,
            ).toISOString()
          : null,
      });
      return;
    }

    case "ProductPurchased": {
      const productId = job.productId as string | undefined;
      if (!productId) return;
      await grantProductFeatures({
        userId,
        productId,
        source: "purchase",
        sourceId: (job.paymentId as string | undefined) ?? null,
      });
      return;
    }

    case "SubscriptionExpired":
    case "SubscriptionSuspended": {
      const subscriptionId = (job.subscriptionId ?? job.aggregateId) as
        | string
        | undefined;
      if (!subscriptionId) return;
      await revokeBySource({
        userId,
        source: "subscription",
        sourceId: subscriptionId,
      });
      return;
    }

    case "SubscriptionCancelled": {
      // Cancellation at period end keeps access until the period ends.
      if (!job.immediate) return;
      const subscriptionId = (job.subscriptionId ?? job.aggregateId) as
        | string
        | undefined;
      if (!subscriptionId) return;
      await revokeBySource({
        userId,
        source: "subscription",
        sourceId: subscriptionId,
      });
      return;
    }

    default:
      return;
  }
}
