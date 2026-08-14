import { mollieGateway } from "../src/lib/billing/gateway/mollie.server";
import { handleGatewayPayment } from "../src/lib/billing/commands.server";
import { drainQueue } from "../src/lib/queue/worker.server";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
const id="tr_zvDfD3nWW4JPFuKtpnNVJ";
let s="pending";
for (let i=0;i<10 && (s==="pending"||s==="authorized");i++){
  await new Promise(r=>setTimeout(r,6000));
  s=(await mollieGateway.getPayment(id)).status;
  console.log(i,s);
}
await handleGatewayPayment("mollie", id);
console.log("drain", JSON.stringify(await drainQueue(25)));
const { data } = await supabaseAdmin.from("billing_subscriptions").select("status,current_period_start,current_period_end,trial_end").eq("id","b90b54fb-c771-4c1e-94bb-dfd69171eaa5").maybeSingle();
console.log(JSON.stringify(data));
