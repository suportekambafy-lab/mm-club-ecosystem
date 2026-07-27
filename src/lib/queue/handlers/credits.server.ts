/** Consumer: credits. Converts purchases and the first paid cycle into MM Studio credits. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recordLedgerEntry } from "@/lib/billing/ledger.server";
import type { JobPayload } from "../types";

/** Welcome credits, released only on the first confirmed paid payment. */
const WELCOME_CREDITS = 400;

export async function creditsConsumer(job: JobPayload): Promise<void> {
  const userId = job.userId as string | undefined;
  if (!userId) return;

  // First confirmed payment (never during a 0 € trial validation) unlocks the
  // welcome credits. The RPC is idempotent by reason, so it only fires once.
  if (job.eventType === "PaymentSucceeded") {
    const amountCents = Number(job.amountCents ?? 0);
    if (amountCents <= 0) return;
    const { data: balance } = await supabaseAdmin.rpc("mm_studio_grant_credits", {
      _user_id: userId,
      _amount: WELCOME_CREDITS,
      _reason: "welcome_bonus",
    });
    void balance;
    return;
  }

  if (job.eventType !== "ProductPurchased") return;
  const credits = Number(job.grantsCredits ?? 0);
  const paymentId = job.paymentId as string | undefined;
  if (credits <= 0 || !paymentId) return;

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
