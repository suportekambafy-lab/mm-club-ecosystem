import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const getClubAccessState = createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async ({context}) => {
 const [role, grants] = await Promise.all([
  context.supabase.rpc("has_role",{_user_id:context.userId,_role:"admin"}),
  context.supabase.from("entitlement_grants").select("expires_at,revoked_at,source,metadata").eq("user_id",context.userId).eq("feature_key","academy.access"),
 ]);
 if (role.error || grants.error) throw new Error("Não foi possível verificar o acesso.");
 return {isAdmin:Boolean(role.data),grants:grants.data ?? [],serverNow:Date.now()};
});