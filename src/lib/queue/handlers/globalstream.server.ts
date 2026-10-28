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
    const { data: sub, error: subError } = await supabaseAdmin.from("mmpay_subscriptions").select("customer_email,customer_name,product_title,currency").eq("id", charge.subscription_id).single();
    if (subError || !sub) throw new Error("Subscription not available");
    sale = globalstreamSalePayload({ id: `charge:${charge.id}`, amount_cents: charge.amount_cents, currency: sub.currency, paid_at: charge.finished_at, email: sub.customer_email, name: sub.customer_name, product_title: sub.product_title, sale_type: "subscription", payment_method: "card" });
  } else {
    const { data: payment, error } = await supabaseAdmin.from("mmpay_payments").select("id,link_id,email,name,status,amount_cents,currency,payment_method,paid_at").eq("id", job.paymentId).single();
    if (error || !payment) throw new Error("Sale not available");
    if (payment.status !== "paid" || !payment.paid_at) return;
    const { data: link, error: linkError } = await supabaseAdmin.from("mmpay_links").select("title,billing_type").eq("id", payment.link_id).maybeSingle();
    if (linkError) throw new Error("Product not available");
    sale = globalstreamSalePayload({ ...payment, paid_at: payment.paid_at, product_title: link?.title ?? "MMpay", sale_type: link?.billing_type ?? "one_time" });
  }
  const body = JSON.stringify(sale);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))), b => b.toString(16).padStart(2, "0")).join("");
  const response = await fetch("https://www.globalstream.live/api/public/hooks/62c76976bfa047158a21cd72ed4883bd", {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", "X-Webhook-Signature": signature, "Idempotency-Key": sale.event_id }, body,
  });
  if (!response.ok || !(response.headers.get("content-type") ?? "").includes("application/json")) {
    throw new Error(`GlobalStream did not acknowledge sale (HTTP ${response.status})`);
  }
}