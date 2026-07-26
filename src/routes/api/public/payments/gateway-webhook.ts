/**
 * Unified gateway webhook. Every payment provider lands here; the gateway
 * adapter normalizes the payload and the engine reconciles the payment.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payments/gateway-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        try {
          const { getGateway, DEFAULT_GATEWAY } = await import(
            "@/lib/billing/gateway/index.server"
          );
          const url = new URL(request.url);
          const gatewayName =
            url.searchParams.get("gateway") ?? DEFAULT_GATEWAY;
          const gw = getGateway(gatewayName);

          const normalized = await gw.normalizeWebhook(body, request.headers);
          if (!normalized) return new Response("ignored", { status: 200 });

          const { handleGatewayPayment } = await import(
            "@/lib/billing/commands.server"
          );
          await handleGatewayPayment(gw.name, normalized.gatewayPaymentId);

          // Consumers run out-of-band; a slow email never blocks the gateway.
          const { drainQueue } = await import("@/lib/queue/worker.server");
          await drainQueue(25);

          return new Response("ok", { status: 200 });
        } catch (err) {
          console.error("[billing webhook]", err);
          // 500 → the gateway retries, and our handlers are idempotent.
          return new Response("error", { status: 500 });
        }
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
