/**
 * Operations API — admin-only observability surface.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BillingHealth } from "@/lib/ops/types";

export const getBillingHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingHealth> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { collectBillingHealth } = await import(
      "@/lib/billing/health.server"
    );
    return collectBillingHealth();
  });

/** Manually runs a billing tick (requeue + drain). Admin only. */
export const runBillingTick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ requeued: number; processed: number; failed: number }> => {
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Forbidden");

      const started = Date.now();
      const { drainQueue, requeueStaleJobs } = await import(
        "@/lib/queue/worker.server"
      );
      const { recordHeartbeat } = await import(
        "@/lib/ops/observability.server"
      );

      const requeued = await requeueStaleJobs(10);
      const { processed, failed } = await drainQueue(50);

      await recordHeartbeat({
        key: "billing-tick",
        ok: true,
        durationMs: Date.now() - started,
        detail: { requeued, processed, failed, manual: true },
      });

      return { requeued, processed, failed };
    },
  );

/** Re-queues failed jobs so they get another chance. Admin only. */
export const retryFailedJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ requeued: number }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data } = await supabaseAdmin
      .from("job_queue")
      .update({
        status: "pending",
        run_after: new Date().toISOString(),
        attempts: 0,
        locked_at: null,
      })
      .in("status", ["failed", "dead"])
      .select("id");

    return { requeued: data?.length ?? 0 };
  });
