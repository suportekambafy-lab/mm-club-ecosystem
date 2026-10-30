import type { JobPayload } from "../types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { globalstreamSalePayload } from "@/lib/mmpay/globalstream";

/** Read only settled revenue; cycle one is represented by its initial payment. */
export async function loadMmpaySale(job: JobPayload) {
  if (typeof job.paymentId !== "string") throw new Error("Invalid sale reference");
  if (job.source === "charge") {
    const { data: charge, error } = await supabaseAdmin.from("mmpay_subscription_charges").select("id,subscription_id,status,cycle_number,amount_cents,finished_at").eq("id", job.paymentId).single();
    if (error || !charge) throw new Error("Sale not available");
    if (charge.status !== "paid" || charge.cycle_number <= 1 || !charge.finished_at) return null;
    const { data: sub, error: subError } = await supabaseAdmin.from("mmpay_subscriptions").select("link_id,customer_email,customer_name,customer_phone,product_title,currency").eq("id", charge.subscription_id).single();
    if (subError || !sub || !sub.link_id) throw new Error("Subscription not available");
    return globalstreamSalePayload({ id: charge.id, amount_cents: charge.amount_cents, currency: sub.currency, email: sub.customer_email, name: sub.customer_name, phone: sub.customer_phone, product_id: sub.link_id, product_title: sub.product_title });
  }
  const { data: payment, error } = await supabaseAdmin.from("mmpay_payments").select("id,link_id,email,name,phone,status,amount_cents,currency,paid_at").eq("id", job.paymentId).single();
  if (error || !payment) throw new Error("Sale not available");
  if (payment.status !== "paid" || !payment.paid_at) return null;
  const { data: link, error: linkError } = await supabaseAdmin.from("mmpay_links").select("title,billing_type").eq("id", payment.link_id).maybeSingle();
  if (linkError) throw new Error("Product not available");
  return globalstreamSalePayload({ ...payment, product_id: payment.link_id, product_title: link?.title ?? "MMpay" });
}