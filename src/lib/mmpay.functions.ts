/**
 * MMpay — superfície de API para a área comercial (criar/gerir links) e para
 * a página pública de pagamento (/pagar/:code). Pagamentos via Stripe.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { secured } from "@/lib/security/gate";
import {
  confirmKlarnaOrderSchema,
  confirmMmpayPaymentSchema,
  createMmpayLinkSchema,
  startKlarnaPaymentSchema,
  startMmpayCheckoutSchema,
  uploadMmpayCoverSchema,
  updateMmpayLinkSchema,
  vivaOrderCodeSchema,
} from "@/lib/mmpay/rules";

async function requireCommercial(context: { supabase: any; userId: string }) {
  const { data: allowed, error } = await context.supabase.rpc("has_commercial_access", {
    _user_id: context.userId,
  });
  if (error || !allowed) throw new Error("Sem permissão para gerir links de pagamento.");
}

export const listMmpayLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireCommercial(context);
    const { listMmpayLinks: list } = await import("@/lib/billing/mmpay.server");
    return list();
  });

export const uploadMmpayCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => uploadMmpayCoverSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireCommercial(context);
    const { uploadMmpayCover: upload } = await import("@/lib/billing/mmpay.server");
    return { url: await upload(data.mime, data.base64) };
  });

export const createMmpayLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createMmpayLinkSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireCommercial(context);
    const { createMmpayLink: create } = await import("@/lib/billing/mmpay.server");
    const link = await create({
      createdBy: context.userId,
      title: data.title,
      description: data.description ?? null,
      amountCents: data.amountCents,
      coverUrl: data.coverUrl ?? null,
      billing: data.billing,
      paymentMethods: data.paymentMethods,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_action_log").insert({
      actor_id: context.userId,
      action: "mmpay.create_link",
      entity_type: "mmpay_link",
      entity_id: link.id,
      after: { code: link.code, title: link.title, amountCents: link.amountCents },
    });
    return link;
  });

export const updateMmpayLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateMmpayLinkSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireCommercial(context);
    const { updateMmpayLink: update } = await import("@/lib/billing/mmpay.server");
    const link = await update({ ...data, description: data.description ?? null, coverUrl: data.coverUrl ?? null });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_action_log").insert({
      actor_id: context.userId,
      action: "mmpay.update_link",
      entity_type: "mmpay_link",
      entity_id: link.id,
      after: { code: link.code, title: link.title, amountCents: link.amountCents },
    });
    return link;
  });

export const setMmpayLinkActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await requireCommercial(context);
    const { setMmpayLinkActive: set } = await import("@/lib/billing/mmpay.server");
    await set(data.id, data.active);
    return { ok: true };
  });

export const deleteMmpayLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await requireCommercial(context);
    const { deleteMmpayLink: del } = await import("@/lib/billing/mmpay.server");
    await del(data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_action_log").insert({
      actor_id: context.userId,
      action: "mmpay.delete_link",
      entity_type: "mmpay_link",
      entity_id: data.id,
    });
    return { ok: true };
  });

/** Vista pública de um link (página /pagar/:code). */
export const getMmpayLink = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ code: z.string().min(8).max(8) }).parse(input))
  .handler(async ({ data }) => {
    const { getPublicMmpayLink } = await import("@/lib/billing/mmpay.server");
    const link = await getPublicMmpayLink(data.code);
    if (!link || !link.active) return { found: false as const };
    return { found: true as const, link };
  });

/** Inicia o pagamento de um link (visitante, sem conta). */
export const startMmpayCheckout = createServerFn({ method: "POST" })
  .middleware([
    ...secured({
      name: "mmpay.startCheckout",
      write: true,
      auth: false,
      emergency: "block",
    }),
  ])
  .inputValidator((input: unknown) => startMmpayCheckoutSchema.parse(input))
  .handler(async ({ data }) => {
    const { startMmpayCheckout: start } = await import("@/lib/billing/mmpay.server");
    return start({
      code: data.code,
      email: data.email,
      name: data.name,
      phone: data.phone,
      origin: data.origin,
      method: data.method,
    });
  });

/** Inicia um pagamento Klarna direto (visitante, sem conta). */
export const startKlarnaMmpayPayment = createServerFn({ method: "POST" })
  .middleware([
    ...secured({
      name: "mmpay.startKlarna",
      write: true,
      auth: false,
      emergency: "block",
    }),
  ])
  .inputValidator((input: unknown) => startKlarnaPaymentSchema.parse(input))
  .handler(async ({ data }) => {
    const { startKlarnaMmpayPayment: start } = await import("@/lib/billing/mmpay.server");
    return start({ code: data.code, email: data.email, name: data.name, phone: data.phone });
  });

/** Conclui o pagamento Klarna com o authorization_token do widget. */
export const confirmKlarnaMmpayOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => confirmKlarnaOrderSchema.parse(input))
  .handler(async ({ data }) => {
    const { confirmKlarnaMmpayOrder: confirm } = await import("@/lib/billing/mmpay.server");
    return confirm(data);
  });

/** Confirma o pagamento quando o cliente regressa do Stripe. */
export const confirmMmpayPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => confirmMmpayPaymentSchema.parse(input))
  .handler(async ({ data }) => {
    const { confirmMmpayPayment: confirm } = await import("@/lib/billing/mmpay.server");
    return confirm(data.code, data.sessionId);
  });

/** Página de retorno da Viva: descobre o link da ordem. */
export const resolveVivaReturn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ orderCode: vivaOrderCodeSchema }).parse(input))
  .handler(async ({ data }) => {
    const { resolveVivaReturn: resolve } = await import("@/lib/billing/mmpay.server");
    return resolve(data.orderCode);
  });

export const listMmpaySubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireCommercial(context);
    const { listSubscriptions } = await import("@/lib/billing/mmpay-subscriptions.server");
    return listSubscriptions();
  });

export const listMmpaySubscriptionCharges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await requireCommercial(context);
    const { listSubscriptionCharges } = await import("@/lib/billing/mmpay-subscriptions.server");
    return listSubscriptionCharges(data.id);
  });

export const chargeMmpaySubscriptionNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), amountCents: z.number().int().min(100).max(10_000_000).nullable() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await requireCommercial(context);
    const { chargeSubscriptionNow } = await import("@/lib/billing/mmpay-subscriptions.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let error: string | null = null;
    try {
      await chargeSubscriptionNow(data.id, data.amountCents ?? undefined);
    } catch (e) {
      error = e instanceof Error ? e.message : "Erro desconhecido";
    }
    await supabaseAdmin.from("admin_action_log").insert({
      actor_id: context.userId,
      action: "mmpay.charge_subscription_now",
      entity_type: "mmpay_subscription",
      entity_id: data.id,
      after: { amount_cents: data.amountCents, ok: !error, error },
    } as never);
    if (error) throw new Error(error);
    return { ok: true };
  });

export const cancelMmpaySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().trim().max(300).nullable() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await requireCommercial(context);
    const { cancelSubscription } = await import("@/lib/billing/mmpay-subscriptions.server");
    await cancelSubscription(data.id, data.reason || null);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_action_log").insert({
      actor_id: context.userId,
      action: "mmpay.cancel_subscription",
      entity_type: "mmpay_subscription",
      entity_id: data.id,
      after: { reason: data.reason },
    });
    return { ok: true };
  });
