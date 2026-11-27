import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireGuestIdentity } from "./live-guest-identity.server";

export async function assertGuestChatAccess(liveId: string, code: string) {
  const { data: live, error } = await supabaseAdmin
    .from("lives")
    .select("id, guest_token, status")
    .eq("id", liveId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!live || !live.guest_token || live.guest_token !== code) {
    throw new Error("Link de convidado inválido ou expirado.");
  }

  const guestId = await requireGuestIdentity(liveId);
  const { data: participant, error: participantError } = await supabaseAdmin.from("live_participants")
    .select("is_guest,banned").eq("live_id", liveId).eq("user_id", guestId).maybeSingle();
  if (participantError || !participant?.is_guest || participant.banned || live.status === "ended" || live.status === "published") throw new Error("Já não tens acesso a esta sessão.");
  return { supabaseAdmin, guestId };
}