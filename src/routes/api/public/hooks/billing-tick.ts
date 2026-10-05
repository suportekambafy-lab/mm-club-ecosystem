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

          // MM Partners: recompensas e benefício grátis sempre em dia.
          const { sweepPartners } = await import("@/lib/partners/core.server");
          const partners = await sweepPartners(40).catch((err) => {
            console.error("[billing-tick] partners sweep", err);
            return 0;
          });
          void partners;

          // Cartão em arquivo: uma vez por dia confirmamos que cada membro com
          // plano tem um método de pagamento utilizável (o banco/gateway pode
          // revogar o mandato sem avisar) e pedimos cartão novo a quem não tem.
          try {
            const { supabaseAdmin } = await import(
              "@/integrations/supabase/client.server"
            );
            // Em lotes pequenos (40 membros por tick de hora) para nunca
            // atrasar a fila de cobranças nem exceder o tempo do pedido.
            const { data: last } = await supabaseAdmin
              .from("ops_heartbeats")
              .select("last_run_at, detail")
              .eq("key", "card-health")
              .limit(1)
              .maybeSingle();
            const lastAt = last?.last_run_at
              ? new Date(last.last_run_at as string).getTime()
              : 0;
            if (Date.now() - lastAt > 3_600_000) {
              const prevOffset = Number(
                (last?.detail as { nextOffset?: number } | null)?.nextOffset ?? 0,
              );
              const BATCH = 40;
              const { sweepCardOnFile } = await import(
                "@/lib/billing/card-health.server"
              );
              const card = await sweepCardOnFile(BATCH, prevOffset);
              await recordHeartbeat({
                key: "card-health",
                ok: true,
                durationMs: 0,
                detail: {
                  checked: card.checked,
                  withoutCard: card.withoutCard,
                  nudged: card.nudged,
                  nextOffset: card.checked < BATCH ? 0 : prevOffset + BATCH,
                },
              });
            }
          } catch (err) {
            console.error("[billing-tick] card health", err);
          }







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
            detail: { requeued, processed, failed, reconciled },
          });

          return new Response(
            JSON.stringify({
              ok: true,
              requeued,
              reconciled,
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
