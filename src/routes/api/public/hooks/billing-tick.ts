/**
 * billing-tick — the permanent heartbeat of the Billing Engine.
 *
 * Called by pg_cron every 5 minutes. Requeues jobs stuck in `running`,
 * drains all due jobs and records a heartbeat used by the Health dashboard.
 *
 * Auth: caller must send the server-only CRON_SECRET in `x-cron-secret`.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/billing-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = verifyCronRequest(request);
        if (denied) return denied;

        const started = Date.now();
        const { recordHeartbeat } = await import(
          "@/lib/ops/observability.server"
        );

        try {
          const { drainQueue, requeueStaleJobs } = await import(
            "@/lib/queue/worker.server"
          );

          const requeued = await requeueStaleJobs(10);

          // Nenhuma dívida sai da recuperação antes dos 90 dias: ciclos sem
          // tentativas agendadas voltam para o calendário.
          const { reopenStalledRecoveries } = await import(
            "@/lib/billing/recovery/engine.server"
          );
          await reopenStalledRecoveries();

          // Ninguém com pagamento em ordem perde acesso: subscrições ativas
          // cujo período expirou são reconciliadas com o gateway.
          const { reconcileLapsedSubscriptions } = await import(
            "@/lib/billing/reconcile.server"
          );
          const reconciled = await reconcileLapsedSubscriptions(25);



          // Drain in batches so a backlog clears within a single tick.
          let processed = 0;
          let failed = 0;
          for (let i = 0; i < 8; i += 1) {
            const res = await drainQueue(25);
            processed += res.processed;
            failed += res.failed;
            if (res.processed + res.failed === 0) break;
          }

          const durationMs = Date.now() - started;
          await recordHeartbeat({
            key: "billing-tick",
            ok: true,
            durationMs,
            detail: { requeued, processed, failed },
          });

          return new Response(
            JSON.stringify({
              ok: true,
              requeued,
              processed,
              failed,
              durationMs,
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[billing-tick] fatal", err);
          await recordHeartbeat({
            key: "billing-tick",
            ok: false,
            durationMs: Date.now() - started,
            detail: { error: message },
          });
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
