/**
 * Notification & Email Engine API.
 * Member-facing history plus the admin communication console.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  CommsOverview,
  NotificationLogRow,
  TemplateOverride,
  TemplateView,
} from "@/lib/notifications/types";

async function assertAdmin(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

/** The member's own communication centre. RLS scopes the read. */
export const getMyCommunications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationLogRow[]> => {
    const { supabase, userId } = context as never as {
      supabase: {
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              c: string,
              v: string,
            ) => {
              order: (
                c: string,
                o: { ascending: boolean },
              ) => {
                limit: (n: number) => Promise<{ data: Record<string, string | null>[] | null }>;
              };
            };
          };
        };
      };
      userId: string;
    };
    const { data } = await supabase
      .from("notification_log")
      .select(
        "id, user_id, recipient, channel, template_key, category, event_type, subject, status, reason, opened_at, clicked_at, resent_of, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    const { TEMPLATES } = await import("@/lib/notifications/catalog");
    return (data ?? []).map((r) => ({
      id: r.id as string,
      userId: r.user_id ?? null,
      recipient: r.recipient as string,
      channel: r.channel as string,
      templateKey: r.template_key as string,
      templateName:
        TEMPLATES[r.template_key as string]?.name ?? (r.template_key as string),
      category: r.category as string,
      eventType: r.event_type ?? null,
      subject: r.subject as string,
      status: r.status as string,
      reason: r.reason ?? null,
      openedAt: r.opened_at ?? null,
      clickedAt: r.clicked_at ?? null,
      resentOf: r.resent_of ?? null,
      createdAt: r.created_at as string,
    }));
  });

export const listCommsTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TemplateView[]> => {
    await assertAdmin(context as never);
    const { listTemplates } = await import("@/lib/notifications/admin.server");
    return listTemplates();
  });

export const getCommsTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ key: z.string() }).parse(i))
  .handler(async ({ data, context }): Promise<TemplateOverride | null> => {
    await assertAdmin(context as never);
    const { getTemplateOverride } = await import(
      "@/lib/notifications/admin.server"
    );
    return getTemplateOverride(data.key);
  });

export const saveCommsTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        key: z.string(),
        subject: z.string().min(1).max(200),
        previewText: z.string().max(300),
        heading: z.string().min(1).max(200),
        bodyHtml: z.string().min(1).max(20000),
        ctaLabel: z.string().max(80).nullable(),
        ctaUrl: z.string().max(500).nullable(),
        active: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { saveTemplate } = await import("@/lib/notifications/admin.server");
    await saveTemplate({
      ...data,
      actorId: (context as never as { userId: string }).userId,
    });
    return { ok: true };
  });

export const resetCommsTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ key: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { resetTemplate } = await import("@/lib/notifications/admin.server");
    await resetTemplate(data.key);
    return { ok: true };
  });

/** Renders a template with sample data — never touches the mail transport. */
export const previewCommsTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ key: z.string() }).parse(i))
  .handler(async ({ data, context }): Promise<{ subject: string; html: string }> => {
    await assertAdmin(context as never);
    const { getTemplateOverride } = await import(
      "@/lib/notifications/admin.server"
    );
    const { previewTemplate } = await import("@/lib/notifications/render");
    const override = await getTemplateOverride(data.key);
    const rendered = previewTemplate(data.key, override);
    if (!rendered) throw new Error("Modelo desconhecido");
    return { subject: rendered.subject, html: rendered.html };
  });

export const sendCommsTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ key: z.string(), to: z.string().email() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { notify } = await import("@/lib/notifications/engine.server");
    const { sampleVariables } = await import("@/lib/notifications/render");
    const result = await notify({
      templateKey: data.key,
      to: data.to,
      vars: sampleVariables(),
      eventType: "admin_test",
      force: true,
    });
    if (!result.sent) throw new Error(result.reason ?? "Falha no envio");
    return { ok: true };
  });

export const listCommsDeliveries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        search: z.string().max(120).nullable().optional(),
        templateKey: z.string().nullable().optional(),
        status: z.string().nullable().optional(),
        userId: z.string().uuid().nullable().optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<NotificationLogRow[]> => {
    await assertAdmin(context as never);
    const { listDeliveries } = await import("@/lib/notifications/admin.server");
    return listDeliveries(data);
  });

export const resendCommsDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ logId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { resendNotification } = await import(
      "@/lib/notifications/engine.server"
    );
    const result = await resendNotification(
      data.logId,
      (context as never as { userId: string }).userId,
    );
    if (!result.sent) throw new Error(result.reason ?? "Falha no reenvio");
    return { ok: true };
  });

export const getCommsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CommsOverview> => {
    await assertAdmin(context as never);
    const { collectCommsOverview } = await import(
      "@/lib/notifications/admin.server"
    );
    return collectCommsOverview();
  });
