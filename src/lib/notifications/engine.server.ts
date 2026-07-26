/**
 * MM Club Notification Engine — the only place that sends member email.
 *
 * No module sends mail directly: everything publishes an event, the engine
 * decides the template, applies the anti-duplication and context rules,
 * renders, delivers and audits. Adding SMS/Push later means adding a
 * transport here — nothing else in the app changes.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { APP_URL, TEMPLATES } from "./catalog";
import { mergeTemplate, renderTemplate } from "./render";
import type { NotificationChannel, TemplateOverride } from "./types";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "MM Club <geral@mmclub.pt>";
const DEDUPE_WINDOW_HOURS = 24;

export type NotifyInput = {
  templateKey: string;
  userId?: string | null;
  /** Overrides the address resolved from the account. */
  to?: string | null;
  channel?: NotificationChannel;
  eventType?: string | null;
  /** Extra template variables on top of the ones the engine resolves. */
  vars?: Record<string, string | number | null | undefined>;
  /** Guarantees one delivery per real-world occurrence. */
  dedupeKey?: string | null;
  /** Invoice this message is about — enables the billing suppression rules. */
  invoiceId?: string | null;
  /** Bypasses the 24h rule (admin resend / test send). */
  force?: boolean;
  resentOf?: string | null;
  resentBy?: string | null;
};

export type NotifyResult = {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  logId?: string | null;
};

// ------------------------------------------------------------------ context

async function loadOverride(key: string): Promise<TemplateOverride | null> {
  const { data } = await supabaseAdmin
    .from("notification_templates")
    .select("*")
    .eq("key", key)
    .maybeSingle();
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    key: r.key as string,
    subject: r.subject as string,
    previewText: (r.preview_text as string) ?? "",
    heading: (r.heading as string) ?? null,
    bodyHtml: (r.body_html as string) ?? "",
    textBody: (r.text_body as string) ?? null,
    ctaLabel: (r.cta_label as string) ?? null,
    ctaUrl: (r.cta_url as string) ?? null,
    category: r.category as string,
    locale: r.locale as string,
    version: r.version as number,
    active: r.active as boolean,
    updatedAt: r.updated_at as string,
  };
}

async function resolveRecipient(
  userId: string | null | undefined,
  to: string | null | undefined,
): Promise<{ email: string; name: string } | null> {
  if (to) return { email: to, name: to.split("@")[0] ?? "amigo" };
  if (!userId) return null;
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = u?.user?.email;
  if (!email) return null;
  const { data: p } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  const name =
    (p as { display_name?: string } | null)?.display_name ??
    email.split("@")[0] ??
    "amigo";
  return { email, name };
}

/** Base variables every template can rely on. */
function baseVars(name: string, email: string) {
  return {
    name,
    firstName: name.split(" ")[0] ?? name,
    email,
    currency: "EUR",
    company: "Snowcountry Lda",
    vat: "517449234",
    supportEmail: "geral@mmclub.pt",
    loginUrl: `${APP_URL}/auth`,
    billingUrl: `${APP_URL}/subscricao`,
    updatePaymentUrl: `${APP_URL}/subscricao`,
    invoiceUrl: `${APP_URL}/subscricao`,
  };
}

// ------------------------------------------------------------------- guards

/**
 * Context rules. A dunning email must never land after the debt is settled,
 * after a chargeback, or while the bank is still deciding.
 */
async function suppressionReason(
  input: NotifyInput,
  category: string,
): Promise<string | null> {
  const dunning = category === "recovery";
  if (!dunning && category !== "billing") return null;
  if (!input.invoiceId) return null;

  const { data: invoice } = await supabaseAdmin
    .from("billing_invoices")
    .select("id, status")
    .eq("id", input.invoiceId)
    .maybeSingle();

  if (dunning && invoice?.status === "paid" && input.templateKey !== "recovery.recovered")
    return "invoice_paid";

  const { data: payments } = await supabaseAdmin
    .from("billing_payments")
    .select("status")
    .eq("invoice_id", input.invoiceId);

  const statuses = (payments ?? []).map((p) => p.status as string);
  if (statuses.includes("chargeback") && input.templateKey !== "billing.chargeback")
    return "chargeback";
  if (
    dunning &&
    statuses.some((s) => s === "pending" || s === "authorized") &&
    input.templateKey !== "billing.payment_started"
  )
    return "payment_pending";

  return null;
}

/** Never the same template to the same person twice within 24h. */
async function recentlySent(
  userId: string | null | undefined,
  recipient: string,
  templateKey: string,
): Promise<boolean> {
  const since = new Date(
    Date.now() - DEDUPE_WINDOW_HOURS * 3_600_000,
  ).toISOString();
  let q = supabaseAdmin
    .from("notification_log")
    .select("id")
    .eq("template_key", templateKey)
    .eq("status", "sent")
    .gte("created_at", since)
    .limit(1);
  q = userId ? q.eq("user_id", userId) : q.eq("recipient", recipient);
  const { data } = await q;
  return (data ?? []).length > 0;
}

async function logDelivery(row: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("notification_log")
    .insert(row as never)
    .select("id")
    .maybeSingle();
  // 23505 = the dedupe key already produced a delivery.
  if (error && error.code !== "23505") {
    console.error("[notifications] log failed", error.message);
  }
  return data?.id ?? null;
}

// ------------------------------------------------------------------ deliver

async function deliverEmail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; providerId?: string | null; error?: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) return { ok: false, error: "missing_credentials" };

  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({
      from: FROM,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });

  const body = await res.text();
  if (!res.ok) return { ok: false, error: `${res.status}: ${body}`.slice(0, 400) };
  try {
    return { ok: true, providerId: JSON.parse(body)?.id ?? null };
  } catch {
    return { ok: true, providerId: null };
  }
}

// -------------------------------------------------------------------- notify

export async function notify(input: NotifyInput): Promise<NotifyResult> {
  const def = TEMPLATES[input.templateKey];
  if (!def) return { sent: false, reason: "unknown_template" };

  const who = await resolveRecipient(input.userId, input.to);
  if (!who) return { sent: false, reason: "no_recipient" };

  const override = await loadOverride(def.key);
  if (override && !override.active && !input.force)
    return { sent: false, skipped: true, reason: "template_inactive" };

  const template = mergeTemplate(def, override);
  const vars = { ...baseVars(who.name, who.email), ...(input.vars ?? {}) };
  const rendered = renderTemplate(template, vars);

  const audit = {
    user_id: input.userId ?? null,
    recipient: who.email,
    channel: input.channel ?? "email",
    template_key: def.key,
    category: def.category,
    event_type: input.eventType ?? null,
    subject: rendered.subject,
    context: { ...vars, invoiceId: input.invoiceId ?? null } as never,
    resent_of: input.resentOf ?? null,
    resent_by: input.resentBy ?? null,
  };

  if (!input.force) {
    const suppressed = await suppressionReason(input, def.category);
    if (suppressed) {
      await logDelivery({ ...audit, status: "skipped", reason: suppressed });
      return { sent: false, skipped: true, reason: suppressed };
    }
    if (await recentlySent(input.userId, who.email, def.key)) {
      await logDelivery({ ...audit, status: "skipped", reason: "duplicate_24h" });
      return { sent: false, skipped: true, reason: "duplicate_24h" };
    }
  }

  const delivery = await deliverEmail({
    to: who.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  if (!delivery.ok) {
    await logDelivery({ ...audit, status: "error", reason: delivery.error ?? null });
    return { sent: false, reason: delivery.error };
  }

  const logId = await logDelivery({
    ...audit,
    status: "sent",
    provider_id: delivery.providerId ?? null,
    dedupe_key: input.dedupeKey ?? null,
  });

  return { sent: true, logId };
}

/** Admin resend: re-delivers a past message with its original context. */
export async function resendNotification(
  logId: string,
  actorId: string,
): Promise<NotifyResult> {
  const { data } = await supabaseAdmin
    .from("notification_log")
    .select("id, user_id, recipient, template_key, event_type, context")
    .eq("id", logId)
    .maybeSingle();
  if (!data) return { sent: false, reason: "not_found" };

  const ctx = (data.context ?? {}) as Record<string, string>;
  return notify({
    templateKey: data.template_key,
    userId: data.user_id,
    to: data.recipient,
    eventType: data.event_type,
    vars: ctx,
    invoiceId: (ctx.invoiceId as string) ?? null,
    force: true,
    resentOf: data.id,
    resentBy: actorId,
  });
}
