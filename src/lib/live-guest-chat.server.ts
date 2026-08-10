import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function assertGuestChatAccess(liveId: string, code: string) {
  const { data: live, error } = await supabaseAdmin
    .from("lives")
    .select("id, guest_token")
    .eq("id", liveId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!live || !live.guest_token || live.guest_token !== code) {
    throw new Error("Link de convidado inválido ou expirado.");
  }

  return supabaseAdmin;
}