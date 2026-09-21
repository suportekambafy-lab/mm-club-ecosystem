/**
 * recovery-charge-all — cobrança imediata de todos os membros em atraso.
 *
 * Antecipa a próxima tentativa de cobrança de cada dívida aberta
 * (past_due / grace_period / suspended) e drena a fila no mesmo pedido.
 * Todos os limites do motor de recuperação continuam a ser respeitados.
 *
 * Auth: `x-cron-secret` (CRON_SECRET).
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/recovery-charge-all")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = verifyCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { triggerRecoveryNow } = await import(
          "@/lib/billing/recovery/engine.server"
        );
        const { drainQueue } = await import("@/lib/queue/worker.server");

        // Opcional: { "userId": "..." } cobra só esse membro.
        let onlyUserId: string | null = null;
        try {
          const body = (await request.json()) as { userId?: string } | null;
          onlyUserId = body?.userId ?? null;
        } catch {
          onlyUserId = null;
        }

        let query = supabaseAdmin
          .from("billing_subscriptions")
          .select("user_id, status")
          .in("status", ["past_due", "grace_period", "suspended"]);
        if (onlyUserId) query = query.eq("user_id", onlyUserId);
        const { data: subs, error } = await query;
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const userIds = Array.from(
          new Set((subs ?? []).map((s) => s.user_id as string)),
        );
        let triggered = 0;
        let failed = 0;
        for (const userId of userIds) {
          try {
            const r = await triggerRecoveryNow(userId, "admin_manual");
            triggered += r.triggered;
          } catch (err) {
            failed += 1;
            console.error("[recovery-charge-all]", userId, err);
          }
        }

        let processed = 0;
        let jobsFailed = 0;
        for (let i = 0; i < 12; i += 1) {
          const res = await drainQueue(25);
          processed += res.processed;
          jobsFailed += res.failed;
          if (res.processed + res.failed === 0) break;
        }

        return new Response(
          JSON.stringify({
            ok: true,
            members: userIds.length,
            triggered,
            failed,
            processed,
            jobsFailed,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
