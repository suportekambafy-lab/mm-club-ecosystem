/**
 * Estado real de uma conta, para o admin poder "ver como cliente".
 * Só administradores; devolve apenas o que a vista precisa.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MemberViewState = {
  userId: string;
  name: string;
  email: string;
  hasAccess: boolean;
  status: string | null;
};

export const getMemberViewState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data, context }): Promise<MemberViewState> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: access }, { data: profile }, { data: sub }, authUser] =
      await Promise.all([
        supabaseAdmin.rpc("has_feature", {
          _user_id: data.userId,
          _feature: "academy.access",
        }),
        supabaseAdmin
          .from("profiles")
          .select("display_name")
          .eq("id", data.userId)
          .maybeSingle(),
        supabaseAdmin
          .from("billing_subscriptions")
          .select("status, updated_at")
          .eq("user_id", data.userId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin.auth.admin.getUserById(data.userId),
      ]);

    const email = authUser.data?.user?.email ?? "";
    return {
      userId: data.userId,
      name: profile?.display_name ?? email.split("@")[0] ?? "Membro",
      email,
      hasAccess: Boolean(access),
      status: (sub?.status as string | null) ?? null,
    };
  });
