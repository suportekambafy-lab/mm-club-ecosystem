CREATE TABLE IF NOT EXISTS public.support_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_actions_user_action_idx
  ON public.support_actions (user_id, action, created_at DESC);

GRANT SELECT ON public.support_actions TO authenticated;
GRANT ALL ON public.support_actions TO service_role;

ALTER TABLE public.support_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own support actions"
  ON public.support_actions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));