-- Remove a sanção criada durante o teste do sistema (membro Madina)
UPDATE public.community_sanctions
SET lifted_at = now()
WHERE user_id = '624432de-bb44-4cb8-90cb-17a5d428a213'
  AND lifted_at IS NULL;

DELETE FROM public.notifications
WHERE user_id = '624432de-bb44-4cb8-90cb-17a5d428a213'
  AND kind = 'moderation';

DELETE FROM public.moderation_actions
WHERE author_id = '624432de-bb44-4cb8-90cb-17a5d428a213';