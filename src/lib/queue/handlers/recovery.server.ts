/**
 * Consumer: recovery.
 * Executes the Revenue Recovery Engine's scheduled work. Every guard lives in
 * the engine — this handler only routes job types.
 */
import type { RecoveryJobPayload } from "@/lib/billing/recovery/engine.server";
import type { JobPayload } from "../types";

export async function recoveryConsumer(job: JobPayload): Promise<void> {
  const payload = job as unknown as RecoveryJobPayload & { jobType?: string };
  if (!payload.cycleKey || !payload.subscriptionId || !payload.userId) return;

  const { runRecoveryAttempt, runRecoveryEscalation } = await import(
    "@/lib/billing/recovery/engine.server"
  );

  if (payload.kind) {
    await runRecoveryEscalation(payload);
    return;
  }
  await runRecoveryAttempt(payload);
}
