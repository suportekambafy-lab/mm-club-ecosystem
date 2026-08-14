import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { startRecovery } from "../src/lib/billing/recovery/engine.server";
import { drainQueue } from "../src/lib/queue/worker.server";
const uid="97ea2732-fa30-4d0f-a663-90b4080b76b5";
const { data: p } = await supabaseAdmin.from("billing_payments").select("*").eq("user_id",uid).order("created_at",{ascending:false}).limit(1).maybeSingle();
console.log("failed payment", p?.gateway_payment_id, p?.status, p?.amount_cents, JSON.stringify(p?.metadata));
await startRecovery({
  subscriptionId: "b90b54fb-c771-4c1e-94bb-dfd69171eaa5",
  userId: uid,
  amountCents: p?.amount_cents ?? 2990,
  currency: p?.currency ?? "EUR",
  failureReason: "Insufficient funds",
  gatewayPaymentId: p!.gateway_payment_id as string,
  method: p?.method ?? null,
});
console.log("drain", JSON.stringify(await drainQueue(20)));
const { data } = await supabaseAdmin.from("billing_dunning_attempts").select("attempt_number,status,phase,scheduled_for,gateway_payment_id,error").eq("user_id",uid).order("attempt_number");
console.log(JSON.stringify(data,null,1));
