REVOKE EXECUTE ON FUNCTION public.my_community_sanction() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_community_sanction() TO authenticated;