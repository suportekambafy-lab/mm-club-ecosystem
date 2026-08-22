DELETE FROM public.community_chat_messages WHERE id IN (
  'fea0b84a-abc2-4dc8-b3c5-faecd41eb693',
  'ad2b2941-0d40-4c9d-b699-e9993632eaad',
  'eaed42d3-2482-4f21-a35a-63c4311bc7cb',
  '32b1a219-892e-4ffe-a990-dfead1eeec75'
);

CREATE TABLE public.moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  target_id uuid NOT NULL,
  author_id uuid,
  action text NOT NULL,
  category text,
  reason text,
  excerpt text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX moderation_actions_target_idx ON public.moderation_actions (target_id);
CREATE INDEX moderation_actions_created_idx ON public.moderation_actions (created_at DESC);

GRANT SELECT ON public.moderation_actions TO authenticated;
GRANT ALL ON public.moderation_actions TO service_role;

ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read moderation actions" ON public.moderation_actions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));