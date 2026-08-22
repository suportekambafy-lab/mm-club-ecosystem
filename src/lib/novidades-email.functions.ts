// Envio do email de novidades (teste + broadcast). Apenas admins.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export const sendNovidadesTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ to: z.string().email() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { sendNovidadesTest } = await import("./novidades-email.server");
    return await sendNovidadesTest(data.to);
  });

export const sendNovidadesBroadcastEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ confirm: z.literal("ENVIAR") }).parse(i))
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { sendNovidadesBroadcast } = await import("./novidades-email.server");
    return await sendNovidadesBroadcast();
  });
