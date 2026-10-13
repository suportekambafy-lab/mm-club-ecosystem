/**
 * Paddle webhook (registered by Paddle as /api/public/payments/webhook?env=…).
 * Public by design: every request is authenticated by the Paddle-Signature HMAC.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = url.searchParams.get("env") === "live" ? "live" : "sandbox";
        const body = await request.text();
        const { verifyPaddleSignature } = await import("@/lib/billing/gateway/paddle.server");
        const secret =
          process.env[env === "live" ? "PAYMENTS_LIVE_WEBHOOK_SECRET" : "PAYMENTS_SANDBOX_WEBHOOK_SECRET"];
        if (!secret || !(await verifyPaddleSignature(body, request.headers.get("paddle-signature"), secret))) {
          return new Response("invalid signature", { status: 401 });
        }

        try {
          const evt = JSON.parse(body) as {
            event_type: string;
            data: { id: string; status?: string; scheduled_change?: { action?: string } | null };
          };
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          if (evt.event_type.startsWith("transaction.")) {
            const { handleGatewayPayment } = await import("@/lib/billing/commands.server");
            await handleGatewayPayment("paddle", evt.data.id);
            const { drainQueue } = await import("@/lib/queue/worker.server");
            await drainQueue(25);
          } else if (evt.event_type === "subscription.canceled") {
            await supabaseAdmin
              .from("billing_subscriptions")
              .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
              .eq("gateway", "paddle")
              .eq("gateway_subscription_id", evt.data.id);
          } else if (evt.event_type === "subscription.updated") {
            await supabaseAdmin
              .from("billing_subscriptions")
              .update({ cancel_at_period_end: evt.data.scheduled_change?.action === "cancel" })
              .eq("gateway", "paddle")
              .eq("gateway_subscription_id", evt.data.id);
          }
          return Response.json({ received: true });
        } catch (err) {
          console.error("[paddle webhook]", err);
          // 500 → Paddle retries; handlers are idempotent.
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
