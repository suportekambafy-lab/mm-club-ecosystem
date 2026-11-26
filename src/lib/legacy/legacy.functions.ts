import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(255), password: z.string().min(8).max(72) });
const GENERIC = "Este email não está na lista de alunos Legacy ou já tem conta. Se já tens conta, entra ou usa «Esqueci-me da palavra-passe».";

export const activateLegacyAccount = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => schema.parse(i))
  .handler(async ({ data }) => {
    const { legacyStudentName, grantLegacyAccess } = await import("./legacy-access.server");
    const name = legacyStudentName(data.email);
    if (name === null) return { ok: false as const, error: GENERIC };
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const created = await db.auth.admin.createUser({ email: data.email, password: data.password, email_confirm: true, user_metadata: { display_name: name || data.email.split("@")[0] } });
    if (created.error || !created.data.user) return { ok: false as const, error: GENERIC };
    await grantLegacyAccess(db, created.data.user.id);
    await db.from("admin_action_log").insert({ action: "legacy.activate", entity_type: "user", entity_id: created.data.user.id, after: { email: data.email } });
    return { ok: true as const };
  });
