/**
 * Notification Engine — admin side (server-only).
 * Template listing/editing, delivery history and analytics.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMPLATES } from "./catalog";
import { mergeTemplate } from "./render";
import type {
  CommsOverview,
  NotificationLogRow,
  TemplateOverride,
  TemplateStat,
  TemplateView,
} from "./types";

const DAY = 86_400_000;

function toOverride(r: Record<string, unknown>): TemplateOverride {
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

export async function listTemplates(): Promise<TemplateView[]> {
  const since = new Date(Date.now() - 30 * DAY).toISOString();
  const [{ data: rawOverrides }, { data: sent }] = await Promise.all([
    supabaseAdmin.from("notification_templates").select("*"),
    supabaseAdmin
      .from("notification_log")
      .select("template_key")
      .eq("status", "sent")
      .gte("created_at", since)
      .limit(5000),
  ]);

  const overrides = new Map(
    (rawOverrides ?? []).map((r) => {
      const o = toOverride(r as Record<string, unknown>);
      return [o.key, o];
    }),
  );
  const counts = new Map<string, number>();
  for (const row of sent ?? [])
    counts.set(row.template_key, (counts.get(row.template_key) ?? 0) + 1);

  return Object.values(TEMPLATES).map((def) => {
    const o = overrides.get(def.key) ?? null;
    const merged = mergeTemplate(def, o);
    return {
      ...merged,
      overridden: Boolean(o),
      active: o?.active ?? true,
      updatedAt: o?.updatedAt ?? null,
      sent30d: counts.get(def.key) ?? 0,
    };
  });
}

export async function getTemplateOverride(
  key: string,
): Promise<TemplateOverride | null> {
  const { data } = await supabaseAdmin
    .from("notification_templates")
    .select("*")
    .eq("key", key)
    .maybeSingle();
  return data ? toOverride(data as Record<string, unknown>) : null;
}

export async function saveTemplate(input: {
  key: string;
  subject: string;
  previewText: string;
  heading: string;
  bodyHtml: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  active: boolean;
  actorId: string;
}): Promise<void> {
  const def = TEMPLATES[input.key];
  if (!def) throw new Error("Modelo desconhecido");

  const existing = await getTemplateOverride(input.key);
  await supabaseAdmin.from("notification_templates").upsert(
    {
      key: input.key,
      channel: def.channel,
      locale: def.locale,
      category: def.category,
      subject: input.subject,
      preview_text: input.previewText,
      heading: input.heading,
      body_html: input.bodyHtml,
      cta_label: input.ctaLabel,
      cta_url: input.ctaUrl,
      variables: def.variables as never,
      version: (existing?.version ?? def.version) + 1,
      active: input.active,
      updated_by: input.actorId,
    } as never,
    { onConflict: "key" },
  );
}

/** Reverts a template to the version shipped in code. */
export async function resetTemplate(key: string): Promise<void> {
  await supabaseAdmin.from("notification_templates").delete().eq("key", key);
}

export async function listDeliveries(filters: {
  search?: string | null;
  templateKey?: string | null;
  status?: string | null;
  userId?: string | null;
  limit?: number;
}): Promise<NotificationLogRow[]> {
  let q = supabaseAdmin
    .from("notification_log")
    .select(
      "id, user_id, recipient, channel, template_key, category, event_type, subject, status, reason, opened_at, clicked_at, resent_of, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);

  if (filters.templateKey) q = q.eq("template_key", filters.templateKey);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.userId) q = q.eq("user_id", filters.userId);
  if (filters.search) q = q.ilike("recipient", `%${filters.search}%`);

  const { data } = await q;
  return (data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    recipient: r.recipient,
    channel: r.channel,
    templateKey: r.template_key,
    templateName: TEMPLATES[r.template_key]?.name ?? r.template_key,
    category: r.category,
    eventType: r.event_type,
    subject: r.subject,
    status: r.status,
    reason: r.reason,
    openedAt: r.opened_at,
    clickedAt: r.clicked_at,
    resentOf: r.resent_of,
    createdAt: r.created_at,
  }));
}

export async function collectCommsOverview(): Promise<CommsOverview> {
  const since = new Date(Date.now() - 30 * DAY).toISOString();
  const { data: rows } = await supabaseAdmin
    .from("notification_log")
    .select(
      "id, user_id, template_key, category, status, opened_at, clicked_at, created_at",
    )
    .gte("created_at", since)
    .limit(10000);

  const log = rows ?? [];
  const sent = log.filter((r) => r.status === "sent");
  const errors = log.filter((r) => r.status === "error");
  const opened = sent.filter((r) => r.opened_at);
  const clicked = sent.filter((r) => r.clicked_at);

  // Recovery attribution: dunning email followed by a settled cycle ≤ 7 days.
  const dunning = sent.filter((r) => r.category === "recovery");
  const userIds = [...new Set(dunning.map((r) => r.user_id).filter(Boolean))];
  const { data: recovered } = userIds.length
    ? await supabaseAdmin
        .from("billing_dunning_attempts")
        .select("user_id, recovered_at")
        .in("user_id", userIds as string[])
        .not("recovered_at", "is", null)
    : { data: [] as { user_id: string; recovered_at: string }[] };

  const recoveredByUser = new Map<string, number[]>();
  for (const r of recovered ?? []) {
    const list = recoveredByUser.get(r.user_id) ?? [];
    list.push(new Date(r.recovered_at as string).getTime());
    recoveredByUser.set(r.user_id, list);
  }

  const attributed = new Set<string>();
  for (const mail of dunning) {
    const times = recoveredByUser.get(mail.user_id ?? "") ?? [];
    const at = new Date(mail.created_at).getTime();
    if (times.some((t) => t >= at && t - at <= 7 * DAY)) attributed.add(mail.id);
  }

  const byTemplate = new Map<string, TemplateStat>();
  for (const r of log) {
    const def = TEMPLATES[r.template_key];
    const stat =
      byTemplate.get(r.template_key) ??
      ({
        key: r.template_key,
        name: def?.name ?? r.template_key,
        category: r.category,
        sent: 0,
        skipped: 0,
        errors: 0,
        opened: 0,
        clicked: 0,
        recovered: 0,
      } as TemplateStat);
    if (r.status === "sent") stat.sent += 1;
    else if (r.status === "skipped") stat.skipped += 1;
    else if (r.status === "error") stat.errors += 1;
    if (r.opened_at) stat.opened += 1;
    if (r.clicked_at) stat.clicked += 1;
    if (attributed.has(r.id)) stat.recovered += 1;
    byTemplate.set(r.template_key, stat);
  }

  const byCategory = new Map<string, number>();
  for (const r of sent)
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);

  const attempted = sent.length + errors.length;
  return {
    sent30d: sent.length,
    deliveryRate: attempted > 0 ? sent.length / attempted : 1,
    openRate: sent.length > 0 ? opened.length / sent.length : 0,
    clickRate: sent.length > 0 ? clicked.length / sent.length : 0,
    recoveryAfterEmail:
      dunning.length > 0 ? attributed.size / dunning.length : 0,
    byCategory: [...byCategory.entries()]
      .map(([category, sentCount]) => ({ category, sent: sentCount }))
      .sort((a, b) => b.sent - a.sent),
    templates: [...byTemplate.values()].sort((a, b) => b.sent - a.sent),
  };
}
