
-- Enum for live status
DO $$ BEGIN
  CREATE TYPE public.live_status AS ENUM ('scheduled','live','ended','published');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LIVES table
CREATE TABLE public.lives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  expert_id text,
  starts_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60,
  visibility text NOT NULL DEFAULT 'club' CHECK (visibility IN ('public','club','premium')),
  cover_url text,
  cf_live_input_id text,
  cf_stream_key text,
  cf_playback_id text,
  cf_rtmps_url text,
  status public.live_status NOT NULL DEFAULT 'scheduled',
  recording_video_uid text,
  published_lesson_id text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lives TO authenticated;
GRANT SELECT ON public.lives TO anon;
GRANT ALL ON public.lives TO service_role;

ALTER TABLE public.lives ENABLE ROW LEVEL SECURITY;

-- Public visibility rows readable by anon; club/premium only for authenticated with entitlement
CREATE POLICY "public lives readable by all"
  ON public.lives FOR SELECT
  USING (visibility = 'public');

CREATE POLICY "club/premium lives readable by entitled users"
  ON public.lives FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'
    OR EXISTS (
      SELECT 1 FROM public.user_entitlements ue
      WHERE ue.user_id = auth.uid()
        AND ue.entitlement::text = lives.visibility
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "admins manage lives"
  ON public.lives FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER lives_updated_at
  BEFORE UPDATE ON public.lives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Access helper (SECURITY DEFINER to bypass RLS from other policies)
CREATE OR REPLACE FUNCTION public.can_access_live(_live_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lives l
    WHERE l.id = _live_id
      AND (
        l.visibility = 'public'
        OR EXISTS (
          SELECT 1 FROM public.user_entitlements ue
          WHERE ue.user_id = _user_id
            AND ue.entitlement::text = l.visibility
        )
        OR public.has_role(_user_id, 'admin')
      )
  );
$$;

-- Chat messages
CREATE TABLE public.live_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX live_chat_messages_live_created_idx
  ON public.live_chat_messages (live_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.live_chat_messages TO authenticated;
GRANT ALL ON public.live_chat_messages TO service_role;

ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read chat if can access live"
  ON public.live_chat_messages FOR SELECT
  TO authenticated
  USING (public.can_access_live(live_id, auth.uid()));

CREATE POLICY "insert own chat if can access live"
  ON public.live_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_access_live(live_id, auth.uid())
  );

CREATE POLICY "author or admin can delete chat"
  ON public.live_chat_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Enable Realtime
ALTER TABLE public.live_chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lives;
