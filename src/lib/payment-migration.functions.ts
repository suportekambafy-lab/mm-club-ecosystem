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
