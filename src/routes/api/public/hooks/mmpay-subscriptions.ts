/**
 * Cobranças recorrentes MMpay (Viva). Chamado por pg_cron a cada 15 minutos.
 * Auth: CRON_SECRET server-only (verifyCronRequest), porque esta rota movimenta dinheiro.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/mmpay-subscriptions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = verifyCronRequest(request);
        if (denied) return denied;
        try {
          const { runDueSubscriptionCharges } = await import("@/lib/billing/mmpay-subscriptions.server");
          return Response.json(await runDueSubscriptionCharges());
        } catch (e) {
          console.error("[mmpay subscriptions]", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
