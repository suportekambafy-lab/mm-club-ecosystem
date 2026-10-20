/**
 * MMpay — links de pagamento com a identidade MM Club.
 *
 * Um link aponta para um preço do catálogo (reutiliza o fluxo de guest
 * checkout, com conta e acessos automáticos) ou para um valor personalizado
 * (cobrança única: o pagamento fica registado, sem acessos associados).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateMmpayCode, validateMmpayLinkInput } from "@/lib/mmpay/rules";
import { getPriceById } from "./catalog.server";
import { getGateway } from "./gateway/index.server";
import { buildCheckoutDescription } from "./description";
import { TRIAL_VERIFICATION_CENTS } from "./types";

export type MmpayLinkRow = {
  id: string;
  code: string;
  title: string;
  price_id: string | null;
  custom_amount_cents: number | null;
  custom_description: string | null;
  created_by: string | null;
  active: boolean;
  created_at: string;
};

export type MmpayLinkView = {
  id: string;
  code: string;
  title: string;
  active: boolean;
  createdAt: string;
  amountCents: number;
  currency: string;
  interval: string | null;
  productName: string | null;
  customDescription: string | null;
};

async function toView(rows: MmpayLinkRow[]): Promise<MmpayLinkView[]> {
  const priceIds = [...new Set(rows.map((r) => r.price_id).filter(Boolean))] as string[];
  const prices = new Map<string, Awaited<ReturnType<typeof getPriceById>>>();
  for (const id of priceIds) prices.set(id, await getPriceById(id));
  return rows.map((r) => {
    const price = r.price_id ? (prices.get(r.price_id) ?? null) : null;
    return {
      id: r.id,
      code: r.code,
      title: r.title,
      active: r.active,
      createdAt: r.created_at,
      amountCents: price?.amountCents ?? r.custom_amount_cents ?? 0,
      currency: price?.currency ?? "EUR",
      interval: price ? price.interval : null,
      productName: price?.product.name ?? null,
      customDescription: r.custom_description,
    };
  });
}

export async function listMmpayLinks(): Promise<MmpayLinkView[]> {
  const { data, error } = await supabaseAdmin
    .from("mmpay_links")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return toView((data ?? []) as MmpayLinkRow[]);
}

export async function createMmpayLink(input: {
  createdBy: string;
  title: string;
  priceId?: string | null;
  customAmountCents?: number | null;
  customDescription?: string | null;
}): Promise<MmpayLinkView> {
  const validationError = validateMmpayLinkInput({
    title: input.title,
    priceId: input.priceId ?? null,
    customAmountCents: input.customAmountCents ?? null,
    customDescription: input.customDescription ?? null,
  });
  if (validationError) throw new Error(validationError);

  if (input.priceId) {
    const price = await getPriceById(input.priceId);
    if (!price) throw new Error("Preço do catálogo não encontrado.");
  }

  // Tenta alguns códigos até encontrar um livre (colisão é raríssima).
  let row: MmpayLinkRow | null = null;
  for (let attempt = 0; attempt < 5 && !row; attempt++) {
    const { data, error } = await supabaseAdmin
      .from("mmpay_links")
      .insert({
        code: generateMmpayCode(),
        title: input.title.trim(),
        price_id: input.priceId ?? null,
        custom_amount_cents: input.customAmountCents ?? null,
        custom_description: input.customDescription?.trim() || null,
        created_by: input.createdBy,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") continue; // código repetido — tenta outro
      throw new Error(error.message);
    }
    row = data as MmpayLinkRow;
  }
  if (!row) throw new Error("Não foi possível gerar o link. Tenta novamente.");
  return (await toView([row]))[0];
}

export async function setMmpayLinkActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabaseAdmin
    .from("mmpay_links")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Vista pública do link (página de pagamento). */
export async function getPublicMmpayLink(code: string): Promise<MmpayLinkView | null> {
  const { data, error } = await supabaseAdmin
    .from("mmpay_links")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return (await toView([data as MmpayLinkRow]))[0];
}

/**
 * Inicia o checkout de um link MMpay. Preço do catálogo → fluxo guest normal
 * (conta + acessos). Valor personalizado → cobrança única sem acessos.
 */
export async function startMmpayCheckout(input: {
  code: string;
  email: string;
  name?: string | null;
  origin: string;
}): Promise<{ checkoutUrl: string; intentId: string }> {
  const { data, error } = await supabaseAdmin
    .from("mmpay_links")
    .select("*")
    .eq("code", input.code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const link = data as MmpayLinkRow | null;
  if (!link || !link.active) throw new Error("Este link de pagamento já não está disponível.");

  const email = input.email.trim().toLowerCase();
  const origin = input.origin.replace(/\/$/, "");

  if (link.price_id) {
    const price = await getPriceById(link.price_id);
    if (!price) throw new Error("Este produto já não está disponível.");
    const { startGuestCheckout } = await import("./guest.server");
    const result = await startGuestCheckout({
      email,
      name: input.name ?? null,
      priceSlug: price.slug,
      origin,
    });
    // Marca o intent com o link MMpay para rastreio.
    const { data: intent } = await supabaseAdmin
      .from("billing_checkout_intents")
      .select("metadata")
      .eq("id", result.intentId)
      .single();
    await supabaseAdmin
      .from("billing_checkout_intents")
      .update({
        metadata: {
          ...((intent?.metadata as Record<string, unknown> | null) ?? {}),
          mmpay: true,
          mmpayLinkId: link.id,
        } as never,
      })
      .eq("id", result.intentId);
    return result;
  }

  // Valor personalizado: cobrança única, sem preço de catálogo.
  const amountCents = link.custom_amount_cents!;
  const description = `${link.title} — ${link.custom_description}`;

  const { data: intent, error: intentError } = await supabaseAdmin
    .from("billing_checkout_intents")
    .insert({
      email,
      name: input.name ?? null,
      status: "pending",
      metadata: { mmpay: true, mmpayLinkId: link.id, customAmountCents: amountCents } as never,
    })
    .select("id")
    .single();
  if (intentError) throw new Error(intentError.message);

  const gw = getGateway();
  const payment = await gw.createCharge({
    amountCents,
    currency: "EUR",
    description,
    redirectUrl: `${origin}/checkout/return?intent=${intent.id}`,
    webhookUrl: `${origin}/api/public/payments/gateway-webhook`,
    customerEmail: email,
    metadata: {
      intentId: intent.id,
      guest: true,
      email,
      mmpay: true,
      mmpayLinkId: link.id,
      kind: "custom",
      origin,
    },
  });

  await supabaseAdmin
    .from("billing_checkout_intents")
    .update({
      gateway: gw.name,
      gateway_payment_id: payment.id,
      status: "awaiting_payment",
    })
    .eq("id", intent.id);

  if (!payment.checkoutUrl) throw new Error("Gateway returned no checkout URL");
  return { checkoutUrl: payment.checkoutUrl, intentId: intent.id };
}

// Re-export para o formulário comercial mostrar o aviso de trial correto.
export { TRIAL_VERIFICATION_CENTS };
export { buildCheckoutDescription };
