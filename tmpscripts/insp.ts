import { supabaseAdmin } from "../src/integrations/supabase/client.server";
const { data, error } = await supabaseAdmin.from("billing_dunning_attempts")
  .select("attempt_number,status,scheduled_for,attempted_at,phase,amount_cents,cycle_key,error,idempotency_key")
  .eq("user_id","97ea2732-fa30-4d0f-a663-90b4080b76b5").order("attempt_number");
console.log(error, JSON.stringify(data,null,1));
