/** Consumer: timeline. Human-readable history of a customer's billing life. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { formatMoney } from "@/lib/billing/types";
import type { JobPayload } from "../types";

type Entry = {
  kind: string;
  title: string;
  description?: string | null;
  amountCents?: number | null;
};

function describe(job: JobPayload): Entry | null {
  const amount = job.amountCents as number | undefined;
  const currency = (job.currency as string) ?? "EUR";
  switch (job.eventType) {
    case "SubscriptionActivated":
      return {
        kind: "subscription",
        title: "Subscrição ativada",
        description: job.currentPeriodEnd
          ? `Renova a ${new Date(String(job.currentPeriodEnd)).toLocaleDateString("pt-PT")}`
          : null,
      };
    case "SubscriptionCancelled":
      return {
        kind: "subscription",
        title: job.immediate
          ? "Subscrição cancelada"
          : "Cancelamento agendado",
        description: job.endsAt
          ? `Acesso até ${new Date(String(job.endsAt)).toLocaleDateString("pt-PT")}`
          : null,
      };
    case "SubscriptionResumed":
      return { kind: "subscription", title: "Subscrição retomada" };
    case "SubscriptionExpired":
      return { kind: "subscription", title: "Subscrição terminada" };
    case "SubscriptionSuspended":
      return { kind: "subscription", title: "Subscrição suspensa" };
    case "PaymentSucceeded":
      return {
        kind: "payment",
        title: "Pagamento recebido",
        description: amount ? formatMoney(amount, currency) : null,
        amountCents: amount ?? null,
      };
    case "PaymentFailed":
      return {
        kind: "payment_failed",
        title: "Pagamento falhado",
        description: (job.reason as string) ?? null,
        amountCents: amount ?? null,
      };
    case "PaymentRefunded":
      return {
        kind: "refund",
        title: "Reembolso emitido",
        amountCents: amount ?? null,
      };
    case "PaymentRecovered":
      return { kind: "payment", title: "Pagamento regularizado" };
    case "DunningEscalated":
      return {
        kind: "dunning",
        title: "Cobrança em atraso",
        description: (job.stage as string) ?? null,
      };
    case "ProductPurchased":
      return {
        kind: "purchase",
        title: `Compra — ${String(job.productName ?? "MM Club")}`,
        description: amount ? formatMoney(amount, currency) : null,
        amountCents: amount ?? null,
      };
    default:
      return null;
  }
}

export async function timelineConsumer(job: JobPayload): Promise<void> {
  const userId = job.userId as string | undefined;
  if (!userId) return;
  const entry = describe(job);
  if (!entry) return;

  await supabaseAdmin.from("billing_timeline").insert({
    user_id: userId,
    subscription_id: (job.subscriptionId as string | undefined) ?? null,
    event_id: (job.__eventId as string | undefined) ?? null,
    kind: entry.kind,
    title: entry.title,
    description: entry.description ?? null,
    amount_cents: entry.amountCents ?? null,
    currency: (job.currency as string) ?? null,
  });
}
