-- 1. Evidência e reversão nas ações do agente de moderação
ALTER TABLE public.moderation_actions
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS severity text,
  ADD COLUMN IF NOT EXISTS reverted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reverted_by uuid,
  ADD COLUMN IF NOT EXISTS review_note text;

CREATE INDEX IF NOT EXISTS moderation_actions_created_idx
  ON public.moderation_actions (created_at DESC);

-- Admins e moderadores podem consultar e revisar o histórico do agente
DROP POLICY IF EXISTS "Staff can read moderation actions" ON public.moderation_actions;
CREATE POLICY "Staff can read moderation actions"
ON public.moderation_actions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Staff can review moderation actions" ON public.moderation_actions;
CREATE POLICY "Staff can review moderation actions"
ON public.moderation_actions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- 2. Recursos (contestações) das sanções
CREATE TABLE IF NOT EXISTS public.moderation_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sanction_id uuid NOT NULL REFERENCES public.community_sanctions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL,
  attachment_url text,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.moderation_appeals TO authenticated;
GRANT UPDATE ON public.moderation_appeals TO authenticated;
GRANT ALL ON public.moderation_appeals TO service_role;

ALTER TABLE public.moderation_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own appeals"
ON public.moderation_appeals FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Members create own appeals"
ON public.moderation_appeals FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.community_sanctions s
    WHERE s.id = sanction_id AND s.user_id = auth.uid() AND s.lifted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.moderation_appeals a
    WHERE a.sanction_id = moderation_appeals.sanction_id AND a.status = 'pending'
  )
);

CREATE POLICY "Staff decide appeals"
ON public.moderation_appeals FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE TRIGGER moderation_appeals_updated_at
BEFORE UPDATE ON public.moderation_appeals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS moderation_appeals_status_idx
  ON public.moderation_appeals (status, created_at DESC);

-- 3. Staff pode levantar sanções ao aceitar um recurso
DROP POLICY IF EXISTS "Staff can lift sanctions" ON public.community_sanctions;
CREATE POLICY "Staff can lift sanctions"
ON public.community_sanctions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Staff can read sanctions" ON public.community_sanctions;
CREATE POLICY "Staff can read sanctions"
ON public.community_sanctions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- 4. Notificações de decisão de recurso
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
CHECK (kind IN ('like','reply','mention','reaction','comment_reply','inactivity','live','course_released','rank','moderation','appeal'));