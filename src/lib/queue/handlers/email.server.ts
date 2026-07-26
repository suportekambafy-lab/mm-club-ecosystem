/** Consumer: email. Transactional mail reacting to billing events. */
import {
  emailTemplates,
  getUserEmailAndName,
  sendEmail,
} from "@/lib/email.server";
import type { JobPayload } from "../types";

export async function emailConsumer(job: JobPayload): Promise<void> {
  const userId = job.userId as string | undefined;
  if (!userId) return;
  const who = await getUserEmailAndName(userId);
  if (!who) return;

  if (job.eventType === "SubscriptionActivated") {
    const tpl = emailTemplates.welcome(who.name, "MM Club Elite");
    await sendEmail({
      to: who.email,
      userId,
      kind: "welcome",
      ref: String(job.subscriptionId ?? job.aggregateId ?? "sub"),
      subject: tpl.subject,
      html: tpl.html,
    });
    return;
  }

  if (job.eventType === "ProductPurchased") {
    const credits = Number(job.grantsCredits ?? 0);
    if (credits <= 0) return;
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
  }
}
