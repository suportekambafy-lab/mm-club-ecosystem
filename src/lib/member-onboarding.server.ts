import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Credentials exist only during creation and the single welcome send, never in app storage or responses. */
export async function createMemberWithPassword(db: SupabaseClient<Database>, email: string, name?: string | null) {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const password = `Mm@${Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")}`;
  const result = await db.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { display_name: name || email.split("@")[0] },
  });
  if (result.error) throw result.error;
  if (!result.data.user) throw new Error("Não foi possível criar a conta.");
  return { id: result.data.user.id, password };
}

export async function sendNewMemberAccess(input: { email: string; name?: string | null; password: string; eventId: string; accessDescription?: string }) {
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  return sendTemplateEmail("club-welcome", input.email, {
    templateData: { email: input.email, name: input.name?.split(" ")[0] || "membro", password: input.password, accessDescription: input.accessDescription },
    idempotencyKey: `club-welcome-${input.eventId}`,
  });
}