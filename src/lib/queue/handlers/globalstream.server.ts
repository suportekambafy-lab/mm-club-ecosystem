import type { JobPayload } from "../types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { globalstreamSalePayload } from "@/lib/mmpay/globalstream";

export async function globalstreamConsumer(job: JobPayload): Promise<void> {
  const secret = process.env["GLOBALSTREAM_WEBHOOK_SECRET"];
  if (!secret) throw new Error("GlobalStream webhook is not configured");
  if (typeof job.paymentId !== "string") throw new Error("Invalid sale reference");
  const recurring = job.source === "charge";
  let sale;
  if (recurring) {
    const { data: charge, error } = await supabaseAdmin.from("mmpay_subscription_charges").select("id,subscription_id,status,cycle_number,amount_cents,finished_at").eq("id", job.paymentId).single();
    if (error || !charge) throw new Error("Sale not available");
    if (charge.status !== "paid" || charge.cycle_number <= 1 || !charge.finished_at) return;
    const { data: sub, error: subError } = await supabaseAdmin.from("mmpay_subscriptions").select("link_id,customer_email,customer_name,customer_phone,product_title,currency").eq("id", charge.subscription_id).single();
    if (subError || !sub || !sub.link_id) throw new Error("Subscription not available");
    sale = globalstreamSalePayload({ id: charge.id, amount_cents: charge.amount_cents, currency: sub.currency, email: sub.customer_email, name: sub.customer_name, phone: sub.customer_phone, product_id: sub.link_id, product_title: sub.product_title });
  } else {
    const { data: payment, error } = await supabaseAdmin.from("mmpay_payments").select("id,link_id,email,name,phone,status,amount_cents,currency,paid_at").eq("id", job.paymentId).single();
    if (error || !payment) throw new Error("Sale not available");
    if (payment.status !== "paid" || !payment.paid_at) return;
    const { data: link, error: linkError } = await supabaseAdmin.from("mmpay_links").select("title,billing_type").eq("id", payment.link_id).maybeSingle();
    if (linkError) throw new Error("Product not available");
    sale = globalstreamSalePayload({ ...payment, product_id: payment.link_id, product_title: link?.title ?? "MMpay" });
  }
  const body = JSON.stringify(sale);
  const response = await fetch("https://www.globalstream.live/api/public/hooks/62c76976bfa047158a21cd72ed4883bd", {
    // Workers reject redirect:"error" before sending the request. Manual
    // redirects preserve the same no-forwarding policy for the secret.
    method: "POST", redirect: "manual", signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}`, "Idempotency-Key": sale.id }, body,
  });
  if (!response.ok) {
    throw new Error(`GlobalStream did not acknowledge sale (HTTP ${response.status})`);
  }
}