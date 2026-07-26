/**
 * Unified gateway webhook. Every payment provider lands here; the gateway
 * adapter normalizes the payload and the engine reconciles the payment.
 * Every call is recorded in the ops webhook log for observability.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payments/gateway-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const started = Date.now();
        const body = await request.text();
        const url = new URL(request.url);
        const { logWebhook } = await import("@/lib/ops/observability.server");

        let gatewayName = "unknown";
        let paymentId: string | null = null;
        try {
          const { getGateway, DEFAULT_GATEWAY } = await import(
            "@/lib/billing/gateway/index.server"
          );
          gatewayName = url.searchParams.get("gateway") ?? DEFAULT_GATEWAY;
          const gw = getGateway(gatewayName);

          const normalized = await gw.normalizeWebhook(body, request.headers);
          if (!normalized) {
            await logWebhook({
              gateway: gatewayName,
              outcome: "ignored",
              durationMs: Date.now() - started,
            });
            return new Response("ignored", { status: 200 });
          }
          paymentId = normalized.gatewayPaymentId;

          const { handleGatewayPayment } = await import(
            "@/lib/billing/commands.server"
          );
          await handleGatewayPayment(gw.name, normalized.gatewayPaymentId);

          // Consumers run out-of-band; a slow email never blocks the gateway.
          const { drainQueue } = await import("@/lib/queue/worker.server");
          await drainQueue(25);

          await logWebhook({
            gateway: gw.name,
            gatewayPaymentId: paymentId,
            outcome: "processed",
            durationMs: Date.now() - started,
          });
          return new Response("ok", { status: 200 });
        } catch (err) {
          console.error("[billing webhook]", err);
          try {
            const { recordSecurityEvent } = await import(
              "@/lib/security/runtime.server"
            );
            await recordSecurityEvent({
              kind: "webhook_rejected",
              severity: "critical",
              ip: request.headers.get("cf-connecting-ip"),
              userAgent: request.headers.get("user-agent"),
              route: "/api/public/payments/gateway-webhook",
              outcome: "blocked",
              reason: err instanceof Error ? err.message.slice(0, 200) : "erro",
              meta: { gateway: gatewayName },
            });
          } catch {
            /* logging must never break the webhook response */
          }
          await logWebhook({
            gateway: gatewayName,
            gatewayPaymentId: paymentId,
            outcome: "error",
            error: err instanceof Error ? err.message : String(err),
            durationMs: Date.now() - started,
          });
          // 500 → the gateway retries, and our handlers are idempotent.
          return new Response("error", { status: 500 });
        }
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
