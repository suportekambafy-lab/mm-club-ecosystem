// Migração Mollie → Paddle: estado do membro e comunicado único por email.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OPEN_STATUSES = ["active", "trialing", "past_due", "grace_period"];
const CAMPAIGN_REF = "paddle-migration-2026-10";

/** O membro ainda tem a subscrição na Mollie e precisa de confirmar o cartão. */
export const getPaymentMigrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("billing_subscriptions")
      .select("gateway, status")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const needsUpdate =
      !!data && data.gateway === "mollie" && OPEN_STATUSES.includes(String(data.status));
    return { needsUpdate };
  });

/**
 * Abre o checkout do Paddle direto para o plano atual do membro, substituindo
 * a subscrição Mollie. Usado pelo botão "Atualizar em 1 minuto" do aviso.
 */
export const startMigrationCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = (input ?? {}) as { origin?: string };
    if (typeof i.origin !== "string" || !/^https?:\/\//.test(i.origin))
      throw new Error("Invalid origin");
    return { origin: i.origin };
  })
  .handler(async ({ context, data }) => {
    const { data: sub } = await context.supabase
      .from("billing_subscriptions")
      .select("id, gateway, status, price_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (
      !sub ||
      sub.gateway !== "mollie" ||
      !OPEN_STATUSES.includes(String(sub.status))
    )
      throw new Error("A tua subscrição já está atualizada.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: price } = await supabaseAdmin
      .from("catalog_prices")
      .select("slug")
      .eq("id", sub.price_id)
      .maybeSingle();
    if (!price?.slug) throw new Error("Não encontrei o teu plano. Fala com o suporte.");

    const { startCheckout: cmd } = await import("@/lib/billing/commands.server");
    const { checkoutUrl } = await cmd({
      userId: context.userId,
      email: (context.claims as { email?: string } | null)?.email ?? null,
      priceSlug: price.slug,
      origin: data.origin,
      successPath: "/dashboard?checkout=success",
    });
    return { checkoutUrl };
  });

/** Admin: envia o comunicado (uma vez por membro) a quem ainda está na Mollie. */
export const sendPaymentMigrationEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendEmail, emailTemplates, getUserEmailAndName } = await import(
      "@/lib/email.server"
    );

    const { data: rows } = await supabaseAdmin
      .from("billing_subscriptions")
      .select("user_id, gateway, status, created_at")
      .order("created_at", { ascending: false });

    // Só a subscrição mais recente de cada membro conta.
    const latest = new Map<string, { gateway: string | null; status: string }>();
    for (const r of rows ?? []) {
      if (!latest.has(r.user_id as string))
        latest.set(r.user_id as string, { gateway: r.gateway, status: String(r.status) });
    }
    const targets = [...latest.entries()]
      .filter(([, s]) => s.gateway === "mollie" && OPEN_STATUSES.includes(s.status))
      .map(([id]) => id);

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const userId of targets) {
      const u = await getUserEmailAndName(userId);
      if (!u?.email) {
        skipped++;
        continue;
      }
      const t = emailTemplates.paymentMethodUpdate({ name: u.name });
      const r = await sendEmail({
        to: u.email,
        subject: t.subject,
        html: t.html,
        userId,
        kind: "payment_method_update",
        ref: CAMPAIGN_REF,
      });
      if (r.sent) sent++;
      else if (r.skipped) skipped++;
      else failed++;
    }
    return { total: targets.length, sent, skipped, failed };
  });

/** Admin: relatório de quem já passou o cartão para o Paddle e quem falta. */
export const getPaymentMigrationReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("billing_subscriptions")
      .select("user_id, gateway, status, current_period_end, updated_at, created_at")
      .order("created_at", { ascending: false });
    const latest = new Map<string, NonNullable<typeof rows>[number]>();
    for (const r of rows ?? []) if (!latest.has(r.user_id as string)) latest.set(r.user_id as string, r);
    const relevant = [...latest.values()].filter(
      (s) => s.gateway === "paddle" || (s.gateway === "mollie" && OPEN_STATUSES.includes(String(s.status))),
    );
    const ids = relevant.map((s) => s.user_id as string);
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] as { id: string; display_name: string | null }[] };
    const names = new Map((profs ?? []).map((p) => [p.id, p.display_name]));
    const now = Date.now();
    const members = relevant.map((s) => {
      const end = s.current_period_end as string | null;
      const paddle = s.gateway === "paddle";
      const overdue = !end || new Date(end).getTime() <= now || ["past_due", "grace_period"].includes(String(s.status));
      return {
        userId: s.user_id as string,
        name: names.get(s.user_id as string) ?? "Membro",
        state: paddle ? "updated" : overdue ? "pending_overdue" : "pending_paid",
        status: String(s.status),
        periodEnd: end,
        updatedAt: s.updated_at as string | null,
      };
    });
    const count = (k: string) => members.filter((m) => m.state === k).length;
    return {
      updated: count("updated"),
      pendingPaid: count("pending_paid"),
      pendingOverdue: count("pending_overdue"),
      members,
    };
  });
