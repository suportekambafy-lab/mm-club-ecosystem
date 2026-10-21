/**
 * MMpay — links de pagamento de vendas avulsas com a identidade MM Club.
 * Cada link cria um produto + preço na conta Stripe do MM Club; o checkout
 * aceita cartão, Apple Pay, Google Pay e MB WAY. Sem acessos associados.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateMmpayCode, validateMmpayLinkInput } from "@/lib/mmpay/rules";
import { getPriceById } from "./catalog.server";
import { createStripeCheckout, createStripeProduct, getStripeCheckout } from "./stripe.server";

export type MmpayLinkRow = {
  id: string;
  code: string;
  title: string;
  price_id: string | null;
  custom_amount_cents: number | null;
  custom_description: string | null;
  description: string | null;
  cover_url: string | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
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
  description: string | null;
  coverUrl: string | null;
  paidCount: number;
};

async function toView(rows: MmpayLinkRow[], withStats = false): Promise<MmpayLinkView[]> {
  const paid = new Map<string, number>();
  if (withStats && rows.length) {
    const { data } = await supabaseAdmin
      .from("mmpay_payments")
      .select("link_id")
      .eq("status", "paid")
      .in("link_id", rows.map((r) => r.id));
    for (const p of data ?? []) paid.set(p.link_id, (paid.get(p.link_id) ?? 0) + 1);
  }
  const out: MmpayLinkView[] = [];
  for (const r of rows) {
    let amount = r.custom_amount_cents ?? 0;
    if (r.price_id && !r.custom_amount_cents) amount = (await getPriceById(r.price_id))?.amountCents ?? 0;
    out.push({
      id: r.id,
      code: r.code,
      title: r.title,
      active: r.active,
      createdAt: r.created_at,
      amountCents: amount,
      currency: "EUR",
      description: r.description ?? r.custom_description,
      coverUrl: r.cover_url,
      paidCount: paid.get(r.id) ?? 0,
    });
  }
  return out;
}

export async function listMmpayLinks(): Promise<MmpayLinkView[]> {
  const { data, error } = await supabaseAdmin
    .from("mmpay_links")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return toView((data ?? []) as MmpayLinkRow[], true);
}

export async function uploadMmpayCover(mime: string, base64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("A imagem tem de ter até 5 MB.");
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin.storage.from("mmpay-covers").upload(path, bytes, { contentType: mime });
  if (error) throw new Error(error.message);
  return supabaseAdmin.storage.from("mmpay-covers").getPublicUrl(path).data.publicUrl;
}

export async function createMmpayLink(input: {
  createdBy: string;
  title: string;
  description: string | null;
  amountCents: number;
  coverUrl: string | null;
}): Promise<MmpayLinkView> {
  const validationError = validateMmpayLinkInput(input);
  if (validationError) throw new Error(validationError);

  let row: MmpayLinkRow | null = null;
  for (let attempt = 0; attempt < 5 && !row; attempt++) {
    const { data, error } = await supabaseAdmin
      .from("mmpay_links")
      .insert({
        code: generateMmpayCode(),
        title: input.title.trim(),
        custom_amount_cents: input.amountCents,
        description: input.description?.trim() || null,
        cover_url: input.coverUrl,
        created_by: input.createdBy,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") continue;
      throw new Error(error.message);
    }
    row = data as MmpayLinkRow;
  }
  if (!row) throw new Error("Não foi possível gerar o link. Tenta novamente.");

  try {
    const stripe = await createStripeProduct({
      name: row.title,
      description: row.description,
      imageUrl: row.cover_url,
      amountCents: input.amountCents,
      linkId: row.id,
    });
    const { data } = await supabaseAdmin
      .from("mmpay_links")
      .update({ stripe_product_id: stripe.productId, stripe_price_id: stripe.priceId })
      .eq("id", row.id)
      .select("*")
      .single();
    row = data as MmpayLinkRow;
  } catch (err) {
    await supabaseAdmin.from("mmpay_links").delete().eq("id", row.id);
    throw new Error(`Stripe recusou o produto: ${err instanceof Error ? err.message : "erro"}`);
  }
  return (await toView([row]))[0];
}

export async function setMmpayLinkActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabaseAdmin.from("mmpay_links").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
}

async function getRow(code: string): Promise<MmpayLinkRow | null> {
  const { data, error } = await supabaseAdmin.from("mmpay_links").select("*").eq("code", code).maybeSingle();
  if (error) throw new Error(error.message);
  return data as MmpayLinkRow | null;
}

export async function getPublicMmpayLink(code: string): Promise<MmpayLinkView | null> {
  const row = await getRow(code);
  return row ? (await toView([row]))[0] : null;
}

/** Abre o checkout Stripe (cartão, Apple Pay, Google Pay, MB WAY). */
export async function startMmpayCheckout(input: {
  code: string;
  email: string;
  name?: string | null;
  origin: string;
}): Promise<{ checkoutUrl: string }> {
  let link = await getRow(input.code);
  if (!link || !link.active) throw new Error("Este link de pagamento já não está disponível.");
  const email = input.email.trim().toLowerCase();
  const origin = input.origin.replace(/\/$/, "");

  if (!link.stripe_price_id) {
    // Link antigo: cria o produto Stripe na primeira utilização.
    const view = (await toView([link]))[0];
    if (view.amountCents < 100) throw new Error("Este link não tem preço válido.");
    const stripe = await createStripeProduct({
      name: link.title,
      description: view.description,
      imageUrl: link.cover_url,
      amountCents: view.amountCents,
      linkId: link.id,
    });
    const { data } = await supabaseAdmin
      .from("mmpay_links")
      .update({ stripe_product_id: stripe.productId, stripe_price_id: stripe.priceId, custom_amount_cents: view.amountCents })
      .eq("id", link.id)
      .select("*")
      .single();
    link = data as MmpayLinkRow;
  }

  const session = await createStripeCheckout({
    priceId: link.stripe_price_id!,
    email,
    successUrl: `${origin}/pagar/${link.code}?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/pagar/${link.code}`,
    metadata: { mmpay_link_id: link.id, mmpay_code: link.code, name: input.name ?? "" },
  });

  await supabaseAdmin.from("mmpay_payments").insert({
    link_id: link.id,
    stripe_session_id: session.id,
    email,
    name: input.name ?? null,
    amount_cents: link.custom_amount_cents ?? 0,
    status: "pending",
  });
  return { checkoutUrl: session.url };
}

/** Confirma o pagamento ao regressar do Stripe (sem webhooks). */
export async function confirmMmpayPayment(code: string, sessionId: string): Promise<{ paid: boolean }> {
  const link = await getRow(code);
  if (!link) return { paid: false };
  const session = await getStripeCheckout(sessionId);
  if (session.metadata?.mmpay_link_id !== link.id) return { paid: false };
  const paid = session.payment_status === "paid";
  const pi = session.payment_intent;
  const method = typeof pi === "object" && pi ? (pi.payment_method?.type ?? null) : null;
  await supabaseAdmin
    .from("mmpay_payments")
    .update({
      status: paid ? "paid" : session.payment_status,
      amount_cents: session.amount_total ?? link.custom_amount_cents ?? 0,
      payment_method: method,
      paid_at: paid ? new Date().toISOString() : null,
    })
    .eq("stripe_session_id", sessionId)
    .neq("status", "paid");
  return { paid };
}
