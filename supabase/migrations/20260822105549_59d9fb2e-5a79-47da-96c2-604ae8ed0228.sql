REVOKE EXECUTE ON FUNCTION public.is_community_restricted(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_community_sanction() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_community_restricted(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_community_sanction() TO authenticated, service_role;