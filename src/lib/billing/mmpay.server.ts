/**
 * MMpay — links de pagamento de vendas avulsas com a identidade MM Club.
 * Cada link cria um produto + preço na conta Stripe do MM Club; o checkout
 * aceita cartão, Apple Pay, Google Pay e MB WAY. Sem acessos associados.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateMmpayCode, validateMmpayLinkInput } from "@/lib/mmpay/rules";
import { getPriceById } from "./catalog.server";
import { installmentAmounts, isValidSchedule, type BillingInterval } from "@/lib/mmpay/subscription-rules";
import { createStripeProduct, deleteStripeProduct, getStripeCheckout, updateStripeProduct } from "./stripe.server";

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
  billing_type: string;
  billing_interval: string | null;
  billing_interval_count: number | null;
  total_cycles: number | null;
  total_amount_cents: number | null;
  installment_schedule_cents?: number[] | null;
};

export type MmpayBilling =
  | { type: "one_time" }
  | { type: "subscription"; interval: BillingInterval; intervalCount: number; totalCycles: number | null; totalCents?: number | null; scheduleCents?: number[] | null };

function billingOf(r: MmpayLinkRow): MmpayBilling {
  if (r.billing_type === "subscription" && r.billing_interval && r.billing_interval_count) {
    return { type: "subscription", interval: r.billing_interval as BillingInterval, intervalCount: r.billing_interval_count, totalCycles: r.total_cycles, totalCents: r.total_amount_cents, scheduleCents: r.installment_schedule_cents ?? null };
  }
  return { type: "one_time" };
}

function billingColumns(b: MmpayBilling | undefined) {
  if (!b || b.type === "one_time") return { billing_type: "one_time", billing_interval: null, billing_interval_count: null, total_cycles: null, total_amount_cents: null, installment_schedule_cents: null };
  const schedule = b.scheduleCents?.length ? b.scheduleCents : null;
  if (schedule && !(b.totalCycles && b.totalCents && isValidSchedule(schedule, b.totalCents, b.totalCycles))) {
    throw new Error("As prestações têm de ser pelo menos 1 € cada e somar exatamente o valor total.");
  }
  return { billing_type: "subscription", billing_interval: b.interval, billing_interval_count: b.intervalCount, total_cycles: b.totalCycles, total_amount_cents: b.totalCents ?? null, installment_schedule_cents: schedule };
}

/**
 * Valor de cada cobrança. Com total + número de prestações, a 1.ª prestação
 * (a que o cliente paga hoje) é a primeira fatia da divisão exata do total.
 */
export function perChargeCents(amountCents: number, billing?: MmpayBilling): number {
  if (billing?.type === "subscription" && billing.totalCycles && billing.totalCents) {
    return installmentAmounts(billing.totalCents, billing.totalCycles, billing.scheduleCents)[0];
  }
  return amountCents;
}

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
  billing: MmpayBilling;
  /** Valor total da venda (assinaturas com prestações); igual a amountCents nas vendas únicas. */
  totalCents: number;
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
      billing: billingOf(r),
      totalCents: r.total_amount_cents ?? amount,
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
  billing?: MmpayBilling;
}): Promise<MmpayLinkView> {
  const validationError = validateMmpayLinkInput(input);
  if (validationError) throw new Error(validationError);
  const chargeCents = perChargeCents(input.amountCents, input.billing);
  if (chargeCents < 100) throw new Error("Cada prestação tem de ser de pelo menos 1,00 €.");

  let row: MmpayLinkRow | null = null;
  for (let attempt = 0; attempt < 5 && !row; attempt++) {
    const { data, error } = await supabaseAdmin
      .from("mmpay_links")
      .insert({
        code: generateMmpayCode(),
        title: input.title.trim(),
        custom_amount_cents: chargeCents,
        description: input.description?.trim() || null,
        cover_url: input.coverUrl,
        created_by: input.createdBy,
        ...billingColumns(input.billing),
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
      amountCents: chargeCents,
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

export async function updateMmpayLink(input: {
  id: string;
  title: string;
  description: string | null;
  amountCents: number;
  coverUrl: string | null;
  billing?: MmpayBilling;
}): Promise<MmpayLinkView> {
  const validationError = validateMmpayLinkInput(input);
  if (validationError) throw new Error(validationError);
  const { data, error } = await supabaseAdmin.from("mmpay_links").select("*").eq("id", input.id).maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as MmpayLinkRow | null;
  if (!row) throw new Error("Este link já não existe.");
  const previous = (await toView([row]))[0];
  const chargeCents = perChargeCents(input.amountCents, input.billing);
  if (chargeCents < 100) throw new Error("Cada prestação tem de ser de pelo menos 1,00 €.");
  const productInput = {
    name: input.title.trim(),
    description: input.description?.trim() || null,
    imageUrl: input.coverUrl,
    amountCents: chargeCents,
  };
  const stripe = row.stripe_product_id && row.stripe_price_id
    ? await updateStripeProduct({ ...productInput, productId: row.stripe_product_id, priceId: row.stripe_price_id, previousAmountCents: previous.amountCents })
    : await createStripeProduct({ ...productInput, linkId: row.id });
  const { data: updated, error: updateError } = await supabaseAdmin.from("mmpay_links").update({
    title: productInput.name,
    description: productInput.description,
    custom_description: productInput.description,
    custom_amount_cents: chargeCents,
    cover_url: input.coverUrl,
    stripe_product_id: stripe.productId,
    stripe_price_id: stripe.priceId,
    ...billingColumns(input.billing),
  }).eq("id", input.id).select("*").single();
  if (updateError) throw new Error(updateError.message);
  return (await toView([updated as MmpayLinkRow], true))[0];
}

export async function setMmpayLinkActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabaseAdmin.from("mmpay_links").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Elimina um link (e os seus pagamentos registados) e o produto Stripe associado. */
export async function deleteMmpayLink(id: string): Promise<void> {
  const { data, error } = await supabaseAdmin.from("mmpay_links").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as MmpayLinkRow | null;
  if (!row) throw new Error("Este link já não existe.");

  if (row.stripe_product_id) await deleteStripeProduct(row.stripe_product_id);
  // Duplicated links share cover URLs. Link deletion must not delete their image.

  const { error: delError } = await supabaseAdmin.from("mmpay_links").delete().eq("id", id);
  if (delError) throw new Error(delError.message);
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

/** Abre o checkout Viva.com (cartão, MB WAY, Apple Pay e Google Pay). */
export async function startMmpayCheckout(input: {
  code: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  origin: string;
  method?: "card" | "mb_way";
}): Promise<{ checkoutUrl: string }> {
  const link = await getRow(input.code);
  if (!link || !link.active) throw new Error("Este link de pagamento já não está disponível.");
  const email = input.email.trim().toLowerCase();
  const view = (await toView([link]))[0];
  if (view.amountCents < 100) throw new Error("Este link não tem preço válido.");

  const { createVivaOrder } = await import("./viva.server");
  const order = await createVivaOrder({
    amountCents: view.amountCents,
    title: link.title,
    email,
    name: input.name,
    phone: input.phone,
    reference: link.code,
    allowRecurring: link.billing_type === "subscription",
  });

  await supabaseAdmin.from("mmpay_payments").insert({
    link_id: link.id,
    stripe_session_id: `vvo_${order.orderCode}`,
    email,
    name: input.name ?? null,
    phone: input.phone ?? null,
    amount_cents: view.amountCents,
    status: "pending",
  });
  return { checkoutUrl: order.checkoutUrl };
}

/** Descobre a que link pertence uma ordem Viva (página de retorno). */
export async function resolveVivaReturn(orderCode: string): Promise<{ code: string | null }> {
  const { data } = await supabaseAdmin
    .from("mmpay_payments")
    .select("link_id")
    .eq("stripe_session_id", `vvo_${orderCode}`)
    .maybeSingle();
  if (!data) return { code: null };
  const { data: link } = await supabaseAdmin.from("mmpay_links").select("code").eq("id", data.link_id).maybeSingle();
  return { code: link?.code ?? null };
}

/** Dá 6 meses de acesso ao MM Club a quem pagou um link MMpay (cria conta se preciso). Idempotente por pagamento. */
export async function grantMmpayClubAccess(sessionRef: string): Promise<void> {
  try {
    const { data: pay } = await supabaseAdmin
      .from("mmpay_payments")
      .select("id,email,name,status")
      .eq("stripe_session_id", sessionRef)
      .maybeSingle();
    if (!pay || pay.status !== "paid" || !pay.email) return;
    const email = pay.email.trim().toLowerCase();
    const { findUserIdByEmail } = await import("./guest.server");
    let userId = await findUserIdByEmail(email);
    let newPassword: string | null = null;
    if (!userId) {
      // Conta nova: palavra-passe gerada e enviada por email (o membro pode alterá-la no perfil).
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
      const bytes = crypto.getRandomValues(new Uint8Array(10));
      newPassword = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("") + "@MM";
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: newPassword,
        email_confirm: true,
        user_metadata: { display_name: pay.name ?? undefined },
      });
      if (error) throw error;
      userId = data.user?.id ?? null;
    }
    if (userId && newPassword) {
      try {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        await sendTemplateEmail("club-welcome", email, {
          templateData: { name: pay.name?.split(" ")[0] ?? "membro", email, password: newPassword },
          idempotencyKey: `club-welcome-${pay.id}`,
        });
      } catch (e) {
        console.error("[mmpay] falha ao enviar email de boas-vindas", email, e);
      }
    }
    if (!userId) return;
    const { error } = await supabaseAdmin.rpc("grant_mmpay_club_access", { _user_id: userId, _payment_id: pay.id });
    if (error) throw error;
  } catch (e) {
    console.error("[mmpay] falha ao dar acesso ao clube", sessionRef, e);
  }
}

/** Marca uma ordem Viva como paga depois de confirmar na própria Viva. Idempotente. */
export async function settleVivaOrder(orderCode: string): Promise<{ paid: boolean }> {
  const { getVivaOrderStatus } = await import("./viva.server");
  const status = await getVivaOrderStatus(orderCode);
  if (!status.paid) return { paid: false };
  const update: { status: string; payment_method: string | null; paid_at: string; amount_cents?: number } = {
    status: "paid",
    payment_method: status.method,
    paid_at: new Date().toISOString(),
  };
  if (status.amountCents) update.amount_cents = status.amountCents;
  await supabaseAdmin
    .from("mmpay_payments")
    .update(update)
    .eq("stripe_session_id", `vvo_${orderCode}`)
    .neq("status", "paid");

  const { data: payment } = await supabaseAdmin
    .from("mmpay_payments")
    .select("link_id,email,name,phone,amount_cents")
    .eq("stripe_session_id", `vvo_${orderCode}`)
    .maybeSingle();
  if (payment) {
    const { data: link } = await supabaseAdmin.from("mmpay_links").select("*").eq("id", payment.link_id).maybeSingle();
    if (link && (link as MmpayLinkRow).billing_type === "subscription") {
      const { activateSubscriptionFromFirstPayment } = await import("./mmpay-subscriptions.server");
      await activateSubscriptionFromFirstPayment({
        link: link as MmpayLinkRow,
        orderCode,
        transactionId: status.transactionId,
        email: payment.email ?? "",
        name: payment.name,
        phone: payment.phone,
        amountCents: status.amountCents ?? payment.amount_cents,
      });
    }
  }
  await grantMmpayClubAccess(`vvo_${orderCode}`);
  return { paid: true };
}

/** Confirma o pagamento ao regressar do checkout (Viva vvo_ ou Stripe cs_ antigos). */
export async function confirmMmpayPayment(code: string, sessionId: string): Promise<{ paid: boolean }> {
  const link = await getRow(code);
  if (!link) return { paid: false };
  if (sessionId.startsWith("vvo_")) {
    const { data } = await supabaseAdmin
      .from("mmpay_payments")
      .select("id")
      .eq("stripe_session_id", sessionId)
      .eq("link_id", link.id)
      .maybeSingle();
    if (!data) return { paid: false };
    return settleVivaOrder(sessionId.slice(4));
  }
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
  if (paid) await grantMmpayClubAccess(sessionId);
  return { paid };
}

/** Inicia um pagamento Klarna direto: cria a sessão e regista o pagamento pendente. */
export async function startKlarnaMmpayPayment(input: {
  code: string;
  email: string;
  name?: string | null;
  phone?: string | null;
}): Promise<{ clientToken: string; sessionRef: string }> {
  const link = await getRow(input.code);
  if (!link || !link.active) throw new Error("Este link de pagamento já não está disponível.");
  const email = input.email.trim().toLowerCase();
  if (link.billing_type === "subscription") throw new Error("Assinaturas não podem ser pagas com Klarna.");
  const view = (await toView([link]))[0];
  if (view.amountCents < 100) throw new Error("Este link não tem preço válido.");

  const { createKlarnaSession } = await import("./klarna.server");
  const session = await createKlarnaSession({
    amountCents: view.amountCents,
    title: link.title,
    email,
    phone: input.phone ?? undefined,
    reference: link.code,
  });
  const sessionRef = `kps_${session.sessionId}`;
  await supabaseAdmin.from("mmpay_payments").insert({
    link_id: link.id,
    stripe_session_id: sessionRef,
    email,
    name: input.name ?? null,
    phone: input.phone ?? null,
    amount_cents: view.amountCents,
    status: "pending",
    payment_method: "klarna",
  });
  return { clientToken: session.clientToken, sessionRef };
}

/** Conclui o pagamento Klarna após a autorização no widget (cria a ordem capturada). */
export async function confirmKlarnaMmpayOrder(input: {
  code: string;
  sessionRef: string;
  authorizationToken: string;
}): Promise<{ paid: boolean }> {
  const link = await getRow(input.code);
  if (!link) return { paid: false };
  const { data: payment } = await supabaseAdmin
    .from("mmpay_payments")
    .select("id,email,phone,amount_cents,status")
    .eq("stripe_session_id", input.sessionRef)
    .eq("link_id", link.id)
    .maybeSingle();
  if (!payment || !payment.email) return { paid: false };
  if (payment.status === "paid") return { paid: true };

  const { placeKlarnaOrder } = await import("./klarna.server");
  const order = await placeKlarnaOrder(input.authorizationToken, {
    amountCents: payment.amount_cents,
    title: link.title,
    email: payment.email,
    phone: payment.phone ?? undefined,
    reference: link.code,
  });
  await supabaseAdmin
    .from("mmpay_payments")
    .update({
      status: "paid",
      payment_method: "klarna",
      paid_at: new Date().toISOString(),
      stripe_session_id: `klo_${order.orderId}`,
    })
    .eq("id", payment.id);
  await grantMmpayClubAccess(`klo_${order.orderId}`);
  return { paid: true };
}
