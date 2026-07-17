
REVOKE EXECUTE ON FUNCTION public.extract_mention_user_ids(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_community_like() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_community_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_community_post() FROM PUBLIC, anon, authenticated;
