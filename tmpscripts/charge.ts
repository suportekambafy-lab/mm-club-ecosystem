import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { mollieGateway } from "../src/lib/billing/gateway/mollie.server";
const uid="97ea2732-fa30-4d0f-a663-90b4080b76b5";
const subId="b90b54fb-c771-4c1e-94bb-dfd69171eaa5";
const priceId="1070e765-c9a8-44b9-aa72-43e523349fa3";
const origin="https://mmclub.pt";
const p = await mollieGateway.chargeWithMandate({
  customerId:"cst_fZEjEx9C8M", mandateId:"mdt_qry8cESTR3",
  amountCents:2990, currency:"EUR",
  description:"MM Club — cobrança de subscrição",
  webhookUrl:`${origin}/api/public/payments/gateway-webhook`,
  metadata:{ userId: uid, priceId, subscriptionId: subId, origin, manualRetry: true },
});
console.log("payment", p.id, p.status);
const { data: c } = await supabaseAdmin.from("billing_customers").select("id").eq("user_id",uid).maybeSingle();
const { error } = await supabaseAdmin.from("billing_payments").upsert({
  customer_id: c!.id, user_id: uid, subscription_id: subId, price_id: priceId,
  gateway: "mollie", gateway_payment_id: p.id, status: p.status,
  amount_cents: p.amountCents, currency: p.currency, method: p.method,
  metadata: { manualRetry: true } as never,
},{ onConflict:"gateway,gateway_payment_id" });
console.log("row", error);
