/**
 * Invoices — one invoice per paid payment.
 * Creation is idempotent (keyed by the payment row) and the PDF is rendered
 * on demand from the stored invoice snapshot, so historic documents never
 * change when the catalog or the company details change.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const SELLER = {
  name: "Snowcountry Lda",
  brand: "MM Club",
  vat: "517449234",
  address: "Portugal",
  email: "geral@mmclub.pt",
  site: "mmclub.pt",
};

export type InvoiceLine = {
  description: string;
  quantity: number;
  unitCents: number;
  amountCents: number;
};

export type InvoiceView = {
  id: string;
  number: string | null;
  status: string;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  taxRate: number;
  lines: InvoiceLine[];
  issuedAt: string | null;
  paidAt: string | null;
};

/** Creates (once) the invoice for a paid payment and links it back. */
export async function ensureInvoiceForPayment(
  paymentRowId: string,
): Promise<string | null> {
  const { data: payment } = await supabaseAdmin
    .from("billing_payments")
    .select(
      "id, user_id, customer_id, subscription_id, invoice_id, status, amount_cents, currency, paid_at, created_at, price_id",
    )
    .eq("id", paymentRowId)
    .maybeSingle();

  if (!payment || payment.status !== "paid") return null;
  if (payment.invoice_id) return payment.invoice_id;

  let customerId = payment.customer_id;
  if (!customerId) {
    const { data: c } = await supabaseAdmin
      .from("billing_customers")
      .select("id")
      .eq("user_id", payment.user_id)
      .maybeSingle();
    customerId = c?.id ?? null;
  }
  if (!customerId) return null;

  let description = "MM Club — Pagamento";
  if (payment.price_id) {
    const { data: price } = await supabaseAdmin
      .from("catalog_prices")
      .select("display_label, interval, product:catalog_products(name)")
      .eq("id", payment.price_id)
      .maybeSingle();
    const label =
      price?.display_label ??
      (price?.product as { name?: string } | null)?.name ??
      "MM Club";
    const cycle =
      price?.interval === "month"
        ? " — subscrição mensal"
        : price?.interval === "year"
          ? " — subscrição anual"
          : "";
    description = `${label}${cycle}`;
  }

  const total = payment.amount_cents;
  const lines: InvoiceLine[] = [
    { description, quantity: 1, unitCents: total, amountCents: total },
  ];

  const { data: numberRow } = await supabaseAdmin.rpc("next_invoice_number");
  const number = (numberRow as unknown as string) ?? null;

  const { data: invoice, error } = await supabaseAdmin
    .from("billing_invoices")
    .insert({
      number,
      customer_id: customerId,
      user_id: payment.user_id,
      subscription_id: payment.subscription_id,
      status: "paid",
      currency: payment.currency,
      subtotal_cents: total,
      discount_cents: 0,
      tax_cents: 0,
      total_cents: total,
      tax_rate: 0,
      lines: lines as never,
      issued_at: payment.paid_at ?? payment.created_at,
      paid_at: payment.paid_at ?? payment.created_at,
      metadata: { paymentId: payment.id } as never,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[billing] ensureInvoiceForPayment", error.message);
    return null;
  }

  await supabaseAdmin
    .from("billing_payments")
    .update({ invoice_id: invoice.id })
    .eq("id", payment.id);

  return invoice.id;
}

/** Creates any missing invoices for a member's paid payments. */
export async function backfillInvoicesForUser(userId: string) {
  const { data: rows } = await supabaseAdmin
    .from("billing_payments")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "paid")
    .is("invoice_id", null)
    .order("created_at", { ascending: true })
    .limit(50);
  for (const r of rows ?? []) {
    await ensureInvoiceForPayment(r.id).catch((e) =>
      console.error("[billing] backfill invoice", e),
    );
  }
}

export function money(cents: number, currency: string): string {
  const value = (cents / 100).toFixed(2).replace(".", ",");
  return `${value} ${currency === "EUR" ? "€" : currency}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export type InvoicePdfData = {
  number: string | null;
  status: string;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  taxRate: number;
  lines: InvoiceLine[];
  issuedAt: string | null;
  paidAt: string | null;
  clientName: string;
  clientEmail: string | null;
  clientVat: string | null;
};

/** Renders the invoice as a branded A4 PDF. Returns raw bytes. */
export async function renderInvoicePdf(invoiceId: string, userId: string) {
  const { data: inv } = await supabaseAdmin
    .from("billing_invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!inv) throw new Error("Invoice not found");

  const { data: customer } = await supabaseAdmin
    .from("billing_customers")
    .select("name, email, company_name, tax_id, address")
    .eq("id", inv.customer_id)
    .maybeSingle();

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("id", inv.user_id)
    .maybeSingle();

  return buildInvoicePdf({
    number: inv.number,
    status: inv.status as string,
    currency: inv.currency,
    subtotalCents: inv.subtotal_cents,
    discountCents: inv.discount_cents,
    taxCents: inv.tax_cents,
    totalCents: inv.total_cents,
    taxRate: Number(inv.tax_rate),
    lines: (inv.lines as unknown as InvoiceLine[]) ?? [],
    issuedAt: inv.issued_at,
    paidAt: inv.paid_at,
    clientName:
      customer?.company_name ||
      customer?.name ||
      profile?.display_name ||
      "Cliente MM Club",
    clientEmail: customer?.email ?? null,
    clientVat: customer?.tax_id ?? null,
  });
}

/** Pure PDF drawing — no database access. */
export async function buildInvoicePdf(inv: InvoicePdfData) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Fatura ${inv.number ?? ""}`.trim());
  pdf.setAuthor(SELLER.name);

  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.09, 0.09, 0.11);
  const muted = rgb(0.45, 0.45, 0.5);
  const gold = rgb(0.788, 0.663, 0.38);
  const line = rgb(0.88, 0.88, 0.9);

  const M = 48;
  const text = (
    s: string,
    x: number,
    y: number,
    opts: { size?: number; font?: typeof regular; color?: typeof ink } = {},
  ) =>
    page.drawText(s, {
      x,
      y,
      size: opts.size ?? 10,
      font: opts.font ?? regular,
      color: opts.color ?? ink,
    });

  // Header band
  page.drawRectangle({
    x: 0,
    y: height - 120,
    width,
    height: 120,
    color: rgb(0.06, 0.06, 0.08),
  });
  page.drawRectangle({ x: 0, y: height - 124, width, height: 4, color: gold });

  text(SELLER.brand, M, height - 60, {
    size: 22,
    font: bold,
    color: rgb(1, 1, 1),
  });
  text(`${SELLER.name} · NIF ${SELLER.vat}`, M, height - 80, {
    size: 9,
    color: rgb(0.75, 0.75, 0.78),
  });
  text(`${SELLER.email} · ${SELLER.site}`, M, height - 94, {
    size: 9,
    color: rgb(0.75, 0.75, 0.78),
  });

  const rightLabel = "FATURA / RECIBO";
  text(
    rightLabel,
    width - M - bold.widthOfTextAtSize(rightLabel, 12),
    height - 60,
    { size: 12, font: bold, color: gold },
  );
  const num = inv.number ?? "—";
  text(num, width - M - regular.widthOfTextAtSize(num, 10), height - 78, {
    size: 10,
    color: rgb(0.9, 0.9, 0.92),
  });
  const dateStr = `Emitida em ${fmtDate(inv.issuedAt)}`;
  text(
    dateStr,
    width - M - regular.widthOfTextAtSize(dateStr, 9),
    height - 94,
    { size: 9, color: rgb(0.75, 0.75, 0.78) },
  );

  // Bill to
  let y = height - 170;
  text("FATURAR A", M, y, { size: 8, font: bold, color: muted });
  y -= 16;
  text(inv.clientName, M, y, { size: 12, font: bold });
  y -= 15;
  if (inv.clientEmail) {
    text(inv.clientEmail, M, y, { size: 10, color: muted });
    y -= 14;
  }
  if (inv.clientVat) {
    text(`NIF ${inv.clientVat}`, M, y, { size: 10, color: muted });
    y -= 14;
  }

  // Status pill
  const paid = inv.status === "paid";
  const pill = paid ? "PAGO" : String(inv.status).toUpperCase();
  const pillW = bold.widthOfTextAtSize(pill, 9) + 20;
  page.drawRectangle({
    x: width - M - pillW,
    y: height - 176,
    width: pillW,
    height: 22,
    color: paid ? rgb(0.85, 0.96, 0.89) : rgb(0.99, 0.93, 0.85),
    borderColor: paid ? rgb(0.55, 0.82, 0.65) : rgb(0.92, 0.75, 0.45),
    borderWidth: 1,
  });
  text(pill, width - M - pillW + 10, height - 170, {
    size: 9,
    font: bold,
    color: paid ? rgb(0.06, 0.4, 0.22) : rgb(0.5, 0.33, 0.05),
  });

  // Table
  let ty = y - 30;
  page.drawRectangle({
    x: M,
    y: ty - 8,
    width: width - M * 2,
    height: 26,
    color: rgb(0.97, 0.97, 0.98),
  });
  text("DESCRIÇÃO", M + 12, ty, { size: 8, font: bold, color: muted });
  text("QTD", width - M - 190, ty, { size: 8, font: bold, color: muted });
  text("PREÇO", width - M - 140, ty, { size: 8, font: bold, color: muted });
  const totLabel = "TOTAL";
  text(totLabel, width - M - 12 - bold.widthOfTextAtSize(totLabel, 8), ty, {
    size: 8,
    font: bold,
    color: muted,
  });

  ty -= 12;
  const lines = inv.lines ?? [];
  for (const l of lines) {
    ty -= 26;
    text(l.description.slice(0, 60), M + 12, ty, { size: 10 });
    text(String(l.quantity), width - M - 190, ty, { size: 10, color: muted });
    text(money(l.unitCents, inv.currency), width - M - 140, ty, {
      size: 10,
      color: muted,
    });
    const amt = money(l.amountCents, inv.currency);
    text(amt, width - M - 12 - regular.widthOfTextAtSize(amt, 10), ty, {
      size: 10,
    });
    page.drawLine({
      start: { x: M, y: ty - 10 },
      end: { x: width - M, y: ty - 10 },
      thickness: 0.5,
      color: line,
    });
  }

  // Totals
  ty -= 34;
  const totals: Array<[string, string, boolean]> = [
    ["Subtotal", money(inv.subtotalCents, inv.currency), false],
  ];
  if (inv.discountCents > 0)
    totals.push([
      "Desconto",
      `-${money(inv.discountCents, inv.currency)}`,
      false,
    ]);
  totals.push([
    `IVA (${Number(inv.taxRate) * 100 || 0}%)`,
    money(inv.taxCents, inv.currency),
    false,
  ]);
  totals.push(["Total", money(inv.totalCents, inv.currency), true]);

  for (const [label, value, strong] of totals) {
    const f = strong ? bold : regular;
    const size = strong ? 13 : 10;
    if (strong) {
      ty -= 12;
      page.drawLine({
        start: { x: width - M - 220, y: ty + 18 },
        end: { x: width - M, y: ty + 18 },
        thickness: 1,
        color: gold,
      });
    }
    text(label, width - M - 220, ty, {
      size,
      font: f,
      color: strong ? ink : muted,
    });
    text(value, width - M - f.widthOfTextAtSize(value, size), ty, {
      size,
      font: f,
    });
    ty -= strong ? 24 : 18;
  }

  if (paid) {
    text(`Pago em ${fmtDate(inv.paidAt)}`, M, ty + 30, {
      size: 10,
      color: muted,
    });
  }

  // Footer
  page.drawLine({
    start: { x: M, y: 92 },
    end: { x: width - M, y: 92 },
    thickness: 0.5,
    color: line,
  });
  text(
    "IVA — regime aplicável ao abrigo da legislação portuguesa. Documento processado por computador.",
    M,
    74,
    { size: 8, color: muted },
  );
  text(
    `${SELLER.name} · NIF ${SELLER.vat} · ${SELLER.address} · ${SELLER.email}`,
    M,
    60,
    { size: 8, color: muted },
  );
  text("Obrigado por fazer parte do MM Club.", M, 44, {
    size: 9,
    font: bold,
    color: gold,
  });

  return pdf.save();
}
