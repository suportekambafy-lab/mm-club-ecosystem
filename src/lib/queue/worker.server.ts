/**
 * Job queue worker.
 * Every consumer runs here: isolated, retried with exponential backoff,
 * and idempotent. A failing consumer never rolls back a payment.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ConsumerName } from "@/lib/billing/consumers";
import { creditsConsumer } from "./handlers/credits.server";
import { emailConsumer } from "./handlers/email.server";
import { entitlementsConsumer } from "./handlers/entitlements.server";
import { notificationsConsumer } from "./handlers/notifications.server";
import { timelineConsumer } from "./handlers/timeline.server";
import type { JobPayload, JobRow } from "./types";

const HANDLERS: Record<ConsumerName, (p: JobPayload) => Promise<void>> = {
  entitlements: entitlementsConsumer,
  credits: creditsConsumer,
  timeline: timelineConsumer,
  email: emailConsumer,
  notifications: notificationsConsumer,
};

const BACKOFF_SECONDS = [10, 60, 300, 1800, 7200];

export type DrainResult = { processed: number; failed: number };

/** Claims and runs up to `limit` due jobs. Safe to call concurrently. */
export async function drainQueue(limit = 25): Promise<DrainResult> {
  const nowIso = new Date().toISOString();

  const { data: candidates } = await supabaseAdmin
    .from("job_queue")
    .select("id, consumer, job_type, payload, attempts, max_attempts")
    .eq("status", "pending")
    .lte("run_after", nowIso)
    .order("run_after")
    .limit(limit);

  let processed = 0;
  let failed = 0;

  for (const raw of (candidates ?? []) as unknown as JobRow[]) {
    // Optimistic lock: only one worker wins the transition to `processing`.
    const { data: claimed } = await supabaseAdmin
      .from("job_queue")
      .update({
        status: "processing",
        locked_at: new Date().toISOString(),
        attempts: raw.attempts + 1,
      })
      .eq("id", raw.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const handler = HANDLERS[raw.consumer as ConsumerName];
    try {
      if (!handler) throw new Error(`Unknown consumer: ${raw.consumer}`);
      await handler(raw.payload ?? {});
      await supabaseAdmin
        .from("job_queue")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          locked_at: null,
          last_error: null,
        })
        .eq("id", raw.id);
      processed += 1;
    } catch (err) {
      failed += 1;
      const attempts = raw.attempts + 1;
      const exhausted = attempts >= raw.max_attempts;
      const delay =
        BACKOFF_SECONDS[Math.min(attempts - 1, BACKOFF_SECONDS.length - 1)];
      await supabaseAdmin
        .from("job_queue")
        .update({
          status: exhausted ? "failed" : "pending",
          locked_at: null,
          run_after: new Date(Date.now() + delay * 1000).toISOString(),
          last_error: err instanceof Error ? err.message : String(err),
        })
        .eq("id", raw.id);
      console.error(`[queue] ${raw.consumer}/${raw.job_type} failed`, err);
    }
  }

  return { processed, failed };
}

/** Re-queues stuck jobs whose worker died mid-flight. */
export async function requeueStaleJobs(olderThanMinutes = 10): Promise<number> {
  const cutoff = new Date(
    Date.now() - olderThanMinutes * 60_000,
  ).toISOString();
  const { data } = await supabaseAdmin
    .from("job_queue")
    .update({ status: "pending", locked_at: null })
    .eq("status", "processing")
    .lt("locked_at", cutoff)
    .select("id");
  return data?.length ?? 0;
}
