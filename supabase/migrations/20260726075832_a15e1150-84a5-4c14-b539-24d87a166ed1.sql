
-- =========================================================================
-- MM Club — Salas Interativas (LiveKit) — schema base
-- =========================================================================

DO $$ BEGIN
  CREATE TYPE public.live_mode AS ENUM ('broadcast', 'interactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.live_role AS ENUM ('host', 'cohost', 'speaker', 'participant', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.live_room_target AS ENUM ('backstage', 'main');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.live_stage_layout AS ENUM ('solo', 'host_guest', 'spotlight', 'grid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.lives
  ADD COLUMN IF NOT EXISTS mode public.live_mode NOT NULL DEFAULT 'broadcast',
  ADD COLUMN IF NOT EXISTS enabled_modules jsonb NOT NULL DEFAULT '["chat"]'::jsonb,
  ADD COLUMN IF NOT EXISTS spotlight_user_id uuid,
  ADD COLUMN IF NOT EXISTS stage_layout public.live_stage_layout NOT NULL DEFAULT 'grid',
  ADD COLUMN IF NOT EXISTS backstage_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS went_live_at timestamptz,
  ADD COLUMN IF NOT EXISTS livekit_room_prefix text;

-- =========================================================================
-- live_participants
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.live_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.live_role NOT NULL DEFAULT 'participant',
  room public.live_room_target NOT NULL DEFAULT 'main',
  on_stage boolean NOT NULL DEFAULT false,
  mic_allowed boolean NOT NULL DEFAULT false,
  cam_allowed boolean NOT NULL DEFAULT false,
  screen_allowed boolean NOT NULL DEFAULT false,
  hand_raised_at timestamptz,
  invited_to_stage_at timestamptz,
  invited_by uuid,
  connection_quality text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  kicked_at timestamptz,
  banned boolean NOT NULL DEFAULT false,
  banned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (live_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_participants TO authenticated;
GRANT ALL ON public.live_participants TO service_role;
ALTER TABLE public.live_participants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS live_participants_live_idx ON public.live_participants (live_id);
CREATE INDEX IF NOT EXISTS live_participants_user_idx ON public.live_participants (user_id);

DROP TRIGGER IF EXISTS live_participants_updated_at ON public.live_participants;
CREATE TRIGGER live_participants_updated_at
BEFORE UPDATE ON public.live_participants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- Helper functions (created after live_participants exists)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.is_live_cohost(_live_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_participants
    WHERE live_id = _live_id AND user_id = _user_id
      AND role IN ('host', 'cohost')
      AND banned = false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_live_publisher(_live_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_participants
    WHERE live_id = _live_id AND user_id = _user_id
      AND role IN ('host', 'cohost', 'speaker')
      AND banned = false
  );
$$;

-- =========================================================================
-- live_participants policies
-- =========================================================================
DROP POLICY IF EXISTS "live_participants_select_main" ON public.live_participants;
CREATE POLICY "live_participants_select_main"
ON public.live_participants FOR SELECT TO authenticated
USING (
  room = 'main'
  OR public.is_live_publisher(live_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "live_participants_insert_self_or_host" ON public.live_participants;
CREATE POLICY "live_participants_insert_self_or_host"
ON public.live_participants FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.is_live_cohost(live_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "live_participants_update_self_or_host" ON public.live_participants;
CREATE POLICY "live_participants_update_self_or_host"
ON public.live_participants FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_live_cohost(live_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  user_id = auth.uid()
  OR public.is_live_cohost(live_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "live_participants_delete_host" ON public.live_participants;
CREATE POLICY "live_participants_delete_host"
ON public.live_participants FOR DELETE TO authenticated
USING (
  public.is_live_cohost(live_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- =========================================================================
-- live_stage_events (audit)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.live_stage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
  actor_id uuid,
  target_user_id uuid,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.live_stage_events TO authenticated;
GRANT ALL ON public.live_stage_events TO service_role;
ALTER TABLE public.live_stage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_stage_events_select_publishers" ON public.live_stage_events;
CREATE POLICY "live_stage_events_select_publishers"
ON public.live_stage_events FOR SELECT TO authenticated
USING (
  public.is_live_publisher(live_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "live_stage_events_insert_publishers" ON public.live_stage_events;
CREATE POLICY "live_stage_events_insert_publishers"
ON public.live_stage_events FOR INSERT TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND (
    public.is_live_publisher(live_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE INDEX IF NOT EXISTS live_stage_events_live_idx ON public.live_stage_events (live_id, created_at DESC);

-- =========================================================================
-- Module: live_reactions
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.live_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.live_reactions TO authenticated;
GRANT ALL ON public.live_reactions TO service_role;
ALTER TABLE public.live_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_reactions_select_all" ON public.live_reactions;
CREATE POLICY "live_reactions_select_all"
ON public.live_reactions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "live_reactions_insert_self" ON public.live_reactions;
CREATE POLICY "live_reactions_insert_self"
ON public.live_reactions FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM public.live_participants lp
    WHERE lp.live_id = live_reactions.live_id
      AND lp.user_id = auth.uid()
      AND lp.banned = true
  )
);

CREATE INDEX IF NOT EXISTS live_reactions_live_idx ON public.live_reactions (live_id, created_at DESC);

-- =========================================================================
-- Module: live_questions
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.live_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  upvotes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'highlighted')),
  answered_at timestamptz,
  highlighted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_questions TO authenticated;
GRANT ALL ON public.live_questions TO service_role;
ALTER TABLE public.live_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_questions_select_all" ON public.live_questions;
CREATE POLICY "live_questions_select_all"
ON public.live_questions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "live_questions_insert_self" ON public.live_questions;
CREATE POLICY "live_questions_insert_self"
ON public.live_questions FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM public.live_participants lp
    WHERE lp.live_id = live_questions.live_id
      AND lp.user_id = auth.uid()
      AND lp.banned = true
  )
);

DROP POLICY IF EXISTS "live_questions_update_author_or_host" ON public.live_questions;
CREATE POLICY "live_questions_update_author_or_host"
ON public.live_questions FOR UPDATE TO authenticated
USING (
  author_id = auth.uid()
  OR public.is_live_cohost(live_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "live_questions_delete_author_or_host" ON public.live_questions;
CREATE POLICY "live_questions_delete_author_or_host"
ON public.live_questions FOR DELETE TO authenticated
USING (
  author_id = auth.uid()
  OR public.is_live_cohost(live_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE INDEX IF NOT EXISTS live_questions_live_idx ON public.live_questions (live_id, created_at DESC);

DROP TRIGGER IF EXISTS live_questions_updated_at ON public.live_questions;
CREATE TRIGGER live_questions_updated_at
BEFORE UPDATE ON public.live_questions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- Module: live_polls
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.live_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  question text NOT NULL CHECK (length(question) BETWEEN 1 AND 300),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  opened_at timestamptz,
  closed_at timestamptz,
  spotlight boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_polls TO authenticated;
GRANT ALL ON public.live_polls TO service_role;
ALTER TABLE public.live_polls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_polls_select_all" ON public.live_polls;
CREATE POLICY "live_polls_select_all"
ON public.live_polls FOR SELECT TO authenticated
USING (status <> 'draft' OR public.is_live_cohost(live_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "live_polls_write_host" ON public.live_polls;
CREATE POLICY "live_polls_write_host"
ON public.live_polls FOR ALL TO authenticated
USING (public.is_live_cohost(live_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.is_live_cohost(live_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS live_polls_live_idx ON public.live_polls (live_id, created_at DESC);

DROP TRIGGER IF EXISTS live_polls_updated_at ON public.live_polls;
CREATE TRIGGER live_polls_updated_at
BEFORE UPDATE ON public.live_polls
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.live_poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.live_polls(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_poll_options TO authenticated;
GRANT ALL ON public.live_poll_options TO service_role;
ALTER TABLE public.live_poll_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_poll_options_select_all" ON public.live_poll_options;
CREATE POLICY "live_poll_options_select_all"
ON public.live_poll_options FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "live_poll_options_write_host" ON public.live_poll_options;
CREATE POLICY "live_poll_options_write_host"
ON public.live_poll_options FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.live_polls p
    WHERE p.id = live_poll_options.poll_id
      AND (public.is_live_cohost(p.live_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.live_polls p
    WHERE p.id = live_poll_options.poll_id
      AND (public.is_live_cohost(p.live_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE INDEX IF NOT EXISTS live_poll_options_poll_idx ON public.live_poll_options (poll_id, sort_order);

CREATE TABLE IF NOT EXISTS public.live_poll_votes (
  poll_id uuid NOT NULL REFERENCES public.live_polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.live_poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.live_poll_votes TO authenticated;
GRANT ALL ON public.live_poll_votes TO service_role;
ALTER TABLE public.live_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_poll_votes_select_all" ON public.live_poll_votes;
CREATE POLICY "live_poll_votes_select_all"
ON public.live_poll_votes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "live_poll_votes_insert_self" ON public.live_poll_votes;
CREATE POLICY "live_poll_votes_insert_self"
ON public.live_poll_votes FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.live_polls p
    WHERE p.id = live_poll_votes.poll_id AND p.status = 'open'
  )
);

DROP POLICY IF EXISTS "live_poll_votes_delete_self" ON public.live_poll_votes;
CREATE POLICY "live_poll_votes_delete_self"
ON public.live_poll_votes FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_participants;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_questions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_polls;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_poll_options;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_poll_votes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
