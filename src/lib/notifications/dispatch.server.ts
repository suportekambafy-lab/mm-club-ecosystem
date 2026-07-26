/**
 * MM Club Notification Engine — event dispatcher (server-only).
 *
 * Translates a domain event into: which template, with which variables.
 * All the "should this even be sent?" logic lives in the engine.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { APP_URL, EVENT_TEMPLATE } from "./catalog";
import { notify, type NotifyResult } from "./engine.server";

const money = (cents: number, currency = "EUR") =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(
    cents / 100,
  );

const day = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

const stamp = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-PT", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

type Ctx = Record<string, string | number | null | undefined>;

async function subscriptionVars(subscriptionId?: string | null): Promise<Ctx> {
  if (!subscriptionId) return {};
  const { data: sub } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("id, price_id, current_period_end")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!sub) return {};

  const { data: price } = await supabaseAdmin
    .from("catalog_prices")
    .select("amount_cents, currency, display_label, product_id")
    .eq("id", sub.price_id)
    .maybeSingle();

  let productName: string | null = null;
  if (price?.product_id) {
    const { data: product } = await supabaseAdmin
      .from("catalog_products")
      .select("name")
      .eq("id", price.product_id)
      .maybeSingle();
    productName = product?.name ?? null;
  }

  return {
    plan: price?.display_label ?? productName ?? "MM Club",
    amount: price ? money(price.amount_cents, price.currency) : undefined,
    dueDate: day(sub.current_period_end),
  };
}


async function invoiceVars(invoiceId?: string | null): Promise<Ctx> {
  if (!invoiceId) return {};
  const { data } = await supabaseAdmin
    .from("billing_invoices")
    .select("id, number, total_cents, currency, issued_at, pdf_url")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!data) return {};
  return {
    invoiceNumber: data.number ?? "—",
    amount: money(data.total_cents, data.currency),
    invoiceDate: day(data.issued_at),
    invoiceUrl: data.pdf_url ?? `${APP_URL}/subscricao`,
  };
}

async function openInvoiceFor(
  userId: string,
  subscriptionId?: string | null,
): Promise<string | null> {
  let q = supabaseAdmin
    .from("billing_invoices")
    .select("id, status, created_at")
    .eq("user_id", userId)
    .neq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(1);
  if (subscriptionId) q = q.eq("subscription_id", subscriptionId);
  const { data } = await q;
  return data?.[0]?.id ?? null;
}

async function methodVars(userId: string): Promise<Ctx> {
  const { data } = await supabaseAdmin
    .from("billing_payment_methods")
    .select("brand, last4, method, is_default")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .limit(1);
  const m = data?.[0];
  if (!m) return { paymentMethod: "o teu método de pagamento" };
  const label = [m.brand ?? m.method ?? "Cartão", m.last4 ? `····${m.last4}` : ""]
    .filter(Boolean)
    .join(" ");
  return { paymentMethod: label };
}

async function recoveryVars(
  userId: string,
  subscriptionId?: string | null,
): Promise<Ctx> {
  let q = supabaseAdmin
    .from("billing_dunning_attempts")
    .select(
      "scheduled_for, status, recovery_score, amount_cents, currency, gateway_error_message, error_category, created_at",
    )
    .eq("user_id", userId)
    .order("scheduled_for", { ascending: true })
    .limit(20);
  if (subscriptionId) q = q.eq("subscription_id", subscriptionId);
  const { data } = await q;
  const rows = data ?? [];
  const next = rows.find((r) => r.status === "scheduled");
  const last = rows[rows.length - 1];
  const firstAt = rows[0]?.created_at ? new Date(rows[0].created_at) : new Date();

  return {
    nextAttempt: next ? stamp(next.scheduled_for) : "brevemente",
    recoveryScore: next?.recovery_score ?? last?.recovery_score ?? undefined,
    debtAmount: last ? money(last.amount_cents, last.currency) : undefined,
    failureReason:
      last?.gateway_error_message ??
      (last?.error_category === "permanent"
        ? "o cartão já não permite cobranças"
        : "o pagamento não foi autorizado"),
    deadline: day(new Date(firstAt.getTime() + 16 * 86_400_000).toISOString()),
    suspensionDate: day(
      new Date(firstAt.getTime() + 16 * 86_400_000).toISOString(),
    ),
  };
}

/** Builds the full variable set for any billing-related message. */
export async function buildContext(args: {
  userId: string;
  subscriptionId?: string | null;
  invoiceId?: string | null;
  extra?: Ctx;
}): Promise<Ctx> {
  const [sub, invoice, method, recovery] = await Promise.all([
    subscriptionVars(args.subscriptionId),
    invoiceVars(args.invoiceId),
    methodVars(args.userId),
    recoveryVars(args.userId, args.subscriptionId),
  ]);
  return { ...sub, ...recovery, ...method, ...invoice, ...(args.extra ?? {}) };
}

/**
 * Entry point used by the queue consumer: one domain event in, at most one
 * notification out.
 */
export async function dispatchEventNotification(
  job: Record<string, unknown>,
): Promise<NotifyResult> {
  const eventType = String(job.eventType ?? "");
  const userId = (job.userId as string | undefined) ?? undefined;
  if (!userId) return { sent: false, reason: "no_user" };

  const stage = job.stage as string | undefined;
  const templateKey = stage
    ? EVENT_TEMPLATE[`stage:${stage}`]
    : EVENT_TEMPLATE[eventType];
  if (!templateKey) return { sent: false, reason: "no_template" };

  const subscriptionId = (job.subscriptionId as string | undefined) ?? null;
  const invoiceId =
    (job.invoiceId as string | undefined) ??
    (await openInvoiceFor(userId, subscriptionId));

  const extra: Ctx = {};
  if (typeof job.amountCents === "number")
    extra.amount = money(job.amountCents, String(job.currency ?? "EUR"));
  if (typeof job.reason === "string" && job.reason) extra.failureReason = job.reason;
  if (typeof job.score === "number") extra.recoveryScore = job.score;

  const vars = await buildContext({ userId, subscriptionId, invoiceId, extra });

  return notify({
    templateKey,
    userId,
    eventType: stage ? `${eventType}:${stage}` : eventType,
    vars,
    invoiceId,
    dedupeKey: job.eventId ? `${templateKey}:${job.eventId}` : null,
  });
}

/** Direct helper for non-billing modules (auth, security, methods). */
export async function notifyMember(
  templateKey: string,
  userId: string,
  extra?: Ctx,
): Promise<NotifyResult> {
  const vars = await buildContext({ userId, extra });
  return notify({ templateKey, userId, vars, eventType: "direct" });
}
