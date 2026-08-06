CREATE TABLE public.email_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  community_posts boolean NOT NULL DEFAULT true,
  community_replies boolean NOT NULL DEFAULT true,
  community_mentions boolean NOT NULL DEFAULT true,
  lives boolean NOT NULL DEFAULT true,
  courses boolean NOT NULL DEFAULT true,
  weekly_summary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_preferences TO authenticated;
GRANT ALL ON public.email_preferences TO service_role;

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own email preferences"
ON public.email_preferences FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users create own email preferences"
ON public.email_preferences FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own email preferences"
ON public.email_preferences FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_email_preferences_updated_at
BEFORE UPDATE ON public.email_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();