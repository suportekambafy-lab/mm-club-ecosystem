/** Consumer: credits. Converts credit-pack purchases into MM Studio credits. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recordLedgerEntry } from "@/lib/billing/ledger.server";
import type { JobPayload } from "../types";

export async function creditsConsumer(job: JobPayload): Promise<void> {
  if (job.eventType !== "ProductPurchased") return;
  const userId = job.userId as string | undefined;
  const credits = Number(job.grantsCredits ?? 0);
  const paymentId = job.paymentId as string | undefined;
  if (!userId || credits <= 0 || !paymentId) return;

  // Idempotent by reason: the RPC ignores a second grant with the same reason.
  await supabaseAdmin.rpc("mm_studio_grant_credits", {
    _user_id: userId,
    _amount: credits,
    _reason: `purchase:${paymentId}`,
  });

  await recordLedgerEntry({
    userId,
    entryType: "credit_granted",
    direction: "credit",
    amountCents: 0,
    creditsDelta: credits,
    sourceType: "payment",
    sourceId: paymentId,
    idempotencyKey: `credits:${paymentId}`,
    memo: `${credits} créditos — ${String(job.productName ?? "MM Studio")}`,
  });
}
