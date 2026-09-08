/**
 * "Entrar como cliente" a sério: o admin passa a estar autenticado na conta do
 * membro (sessão real), para ver e testar exactamente o que ele vê.
 *
 * Só administradores. Fica registado em `admin_action_log`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ImpersonationTicket = {
  userId: string;
  name: string;
  email: string;
  /** Token de uso único para o browser abrir a sessão do membro. */
  tokenHash: string;
};

export const startImpersonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ImpersonationTicket> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    if (data.userId === context.userId) throw new Error("Já é a tua conta.");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const target = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const email = target.data?.user?.email;
    if (!email) throw new Error("Este membro não tem email.");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", data.userId)
      .maybeSingle();

    const link = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const tokenHash = link.data?.properties?.hashed_token;
    if (link.error || !tokenHash) {
      throw new Error(link.error?.message ?? "Não foi possível abrir a sessão.");
    }

    await supabaseAdmin.from("admin_action_log").insert({
      actor_id: context.userId,
      action: "impersonate.start",
      target_type: "user",
      target_id: data.userId,
      details: { email },
    });

    return {
      userId: data.userId,
      name: profile?.display_name ?? email.split("@")[0] ?? "Membro",
      email,
      tokenHash,
    };
  });
