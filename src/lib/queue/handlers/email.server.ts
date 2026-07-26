/**
 * Consumer: email.
 * Nothing here decides copy or timing — it hands the event to the
 * Notification Engine, which owns templates, rules and auditing.
 */
import type { JobPayload } from "../types";

export async function emailConsumer(job: JobPayload): Promise<void> {
  const { dispatchEventNotification } = await import(
    "@/lib/notifications/dispatch.server"
  );
  const { emailTemplates, getUserEmailAndName, sendEmail } = await import(
    "@/lib/email.server"
  );

  // Credit packs keep their own (non-billing) template for now.
  if (job.eventType === "ProductPurchased") {
    const userId = job.userId as string | undefined;
    const credits = Number(job.grantsCredits ?? 0);
    if (!userId || credits <= 0) return;
    const who = await getUserEmailAndName(userId);
    if (!who) return;
    const tpl = emailTemplates.creditsTopup(
      who.name,
      credits,
      String(job.productName ?? "Pack de créditos"),
    );
    await sendEmail({
      to: who.email,
      userId,
      kind: "credits_topup",
      ref: String(job.paymentId ?? ""),
      subject: tpl.subject,
      html: tpl.html,
    });
    return;
  }

  await dispatchEventNotification(job as Record<string, unknown>);
}
