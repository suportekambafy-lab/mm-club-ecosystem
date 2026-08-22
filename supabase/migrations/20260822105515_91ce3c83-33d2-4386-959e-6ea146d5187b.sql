-- Sanções progressivas do Código do Clube
CREATE TABLE public.community_sanctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  level int NOT NULL DEFAULT 1,
  kind text NOT NULL DEFAULT 'mute',
  reason text NOT NULL,
  rule text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  permanent boolean NOT NULL DEFAULT false,
  lifted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX community_sanctions_user_idx ON public.community_sanctions (user_id, created_at DESC);

GRANT SELECT ON public.community_sanctions TO authenticated;
GRANT ALL ON public.community_sanctions TO service_role;

ALTER TABLE public.community_sanctions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own sanctions"
  ON public.community_sanctions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage sanctions"
  ON public.community_sanctions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER community_sanctions_updated_at
  BEFORE UPDATE ON public.community_sanctions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- true quando o membro está impedido de interagir agora
CREATE OR REPLACE FUNCTION public.is_community_restricted(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_sanctions s
    WHERE s.user_id = _user_id
      AND s.lifted_at IS NULL
      AND s.kind IN ('mute','ban')
      AND (s.permanent OR s.expires_at IS NULL OR s.expires_at > now())
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_community_restricted(uuid) FROM anon;

-- Sanção ativa (para mostrar motivo e prazo ao membro)
CREATE OR REPLACE FUNCTION public.my_community_sanction()
RETURNS TABLE(kind text, level int, reason text, rule text, expires_at timestamptz, permanent boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.kind, s.level, s.reason, s.rule, s.expires_at, s.permanent
  FROM public.community_sanctions s
  WHERE s.user_id = auth.uid()
    AND s.lifted_at IS NULL
    AND s.kind IN ('mute','ban')
    AND (s.permanent OR s.expires_at IS NULL OR s.expires_at > now())
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.my_community_sanction() FROM anon;

-- Bloqueio efetivo das ações na comunidade enquanto a sanção estiver ativa
DROP POLICY "Users create own posts" ON public.community_posts;
CREATE POLICY "Users create own posts" ON public.community_posts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND NOT public.is_community_restricted(auth.uid()));

DROP POLICY "Users create own comments" ON public.community_comments;
CREATE POLICY "Users create own comments" ON public.community_comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND NOT public.is_community_restricted(auth.uid()));

DROP POLICY "Users can post their own chat messages" ON public.community_chat_messages;
CREATE POLICY "Users can post their own chat messages" ON public.community_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND NOT public.is_community_restricted(auth.uid()));

DROP POLICY "Users can create their own shorts" ON public.mm_shorts;
CREATE POLICY "Users can create their own shorts" ON public.mm_shorts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND NOT public.is_community_restricted(auth.uid()));

DROP POLICY "Users insert own comments" ON public.mm_short_comments;
CREATE POLICY "Users insert own comments" ON public.mm_short_comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_community_restricted(auth.uid()));

DROP POLICY "Users create own likes" ON public.community_likes;
CREATE POLICY "Users create own likes" ON public.community_likes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_community_restricted(auth.uid()));

DROP POLICY "Users can add own reactions" ON public.community_reactions;
CREATE POLICY "Users can add own reactions" ON public.community_reactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_community_restricted(auth.uid()));

DROP POLICY "insert own chat if can access live" ON public.live_chat_messages;
CREATE POLICY "insert own chat if can access live" ON public.live_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_access_live(live_id, auth.uid())
    AND NOT public.is_community_restricted(auth.uid())
  );

-- Notificação explicando a sanção
ALTER TABLE public.moderation_actions
  ADD COLUMN IF NOT EXISTS sanction_id uuid REFERENCES public.community_sanctions(id) ON DELETE SET NULL;