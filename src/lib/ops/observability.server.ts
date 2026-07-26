/**
 * Observability primitives for the Billing Engine.
 * Everything here is best-effort: a failed metric write must never break
 * a payment, a webhook or a cron run.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type HeartbeatKey = "billing-tick";

export async function recordHeartbeat(input: {
  key: HeartbeatKey | string;
  ok: boolean;
  durationMs: number;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { data: prev } = await supabaseAdmin
      .from("ops_heartbeats")
      .select("runs")
      .eq("key", input.key)
      .maybeSingle();

    await supabaseAdmin.from("ops_heartbeats").upsert(
      {
        key: input.key,
        last_run_at: new Date().toISOString(),
        ok: input.ok,
        duration_ms: Math.round(input.durationMs),
        detail: (input.detail ?? {}) as never,
        runs: (prev?.runs ?? 0) + 1,
      },
      { onConflict: "key" },
    );
  } catch (err) {
    console.error("[observability] heartbeat failed", err);
  }
}

export type WebhookOutcome = "processed" | "ignored" | "rejected" | "error";

export async function logWebhook(input: {
  gateway: string;
  gatewayPaymentId?: string | null;
  outcome: WebhookOutcome;
  error?: string | null;
  durationMs?: number;
}): Promise<void> {
  try {
    await supabaseAdmin.from("ops_webhook_log").insert({
      gateway: input.gateway,
      gateway_payment_id: input.gatewayPaymentId ?? null,
      outcome: input.outcome,
      error: input.error ?? null,
      duration_ms:
        input.durationMs != null ? Math.round(input.durationMs) : null,
    });
  } catch (err) {
    console.error("[observability] webhook log failed", err);
  }
}
