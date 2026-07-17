REVOKE ALL ON FUNCTION public.notify_on_community_like() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_community_comment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_community_post() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.extract_mention_user_ids(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;