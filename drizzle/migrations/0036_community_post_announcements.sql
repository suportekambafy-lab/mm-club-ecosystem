CREATE TABLE public.community_post_announcements (
  post_id uuid PRIMARY KEY,
  announce boolean,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.community_post_announcements TO service_role;
ALTER TABLE public.community_post_announcements ENABLE ROW LEVEL SECURITY;