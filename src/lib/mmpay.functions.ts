/**
 * MMpay — superfície de API para a área comercial (criar/gerir links) e para
 * a página pública de pagamento (/pagar/:code).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { secured } from "@/lib/security/gate";
import { createMmpayLinkSchema, startMmpayCheckoutSchema } from "@/lib/mmpay/rules";

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

export const createMmpayLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createMmpayLinkSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireCommercial(context);
    const { createMmpayLink: create } = await import("@/lib/billing/mmpay.server");
    const link = await create({
      createdBy: context.userId,
      title: data.title,
      priceId: data.priceId ?? null,
      customAmountCents: data.customAmountCents ?? null,
      customDescription: data.customDescription ?? null,
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

/** Vista pública de um link (página /pagar/:code). */
export const getMmpayLink = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().min(8).max(8) }).parse(input),
  )
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
      limit: [
        { bucket: "mmpay-checkout", max: 6, windowSeconds: 3600, scope: "ip" },
        { bucket: "mmpay-checkout-day", max: 20, windowSeconds: 86400, scope: "ip" },
      ],
    }),
  ])
  .inputValidator((input: unknown) => startMmpayCheckoutSchema.parse(input))
  .handler(async ({ data }) => {
    const { startMmpayCheckout: start } = await import("@/lib/billing/mmpay.server");
    return start({
      code: data.code,
      email: data.email,
      name: data.name ?? null,
      origin: data.origin,
    });
  });
