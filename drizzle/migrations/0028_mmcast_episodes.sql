CREATE TABLE public.mmcast_episodes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  episode_number integer NOT NULL UNIQUE,
  title text NOT NULL,
  guest_name text,
  youtube_url text NOT NULL,
  youtube_video_id text NOT NULL,
  thumbnail_url text,
  short_description text,
  full_description text,
  category text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX idx_mmcast_episodes_published
  ON public.mmcast_episodes (published_at DESC)
  WHERE status = 'published';

GRANT SELECT ON public.mmcast_episodes TO authenticated;
GRANT ALL ON public.mmcast_episodes TO service_role;

ALTER TABLE public.mmcast_episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view published episodes"
  ON public.mmcast_episodes FOR SELECT
  TO authenticated
  USING (status = 'published');

CREATE POLICY "Admins manage episodes"
  ON public.mmcast_episodes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('like','reply','mention','reaction','comment_reply','inactivity','live','course_released','rank','moderation','appeal','partner_pending','partner_approved','partner_rejected','mmcast'));

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS mmcast_episode_id uuid REFERENCES public.mmcast_episodes(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_mmcast_unique
  ON public.notifications (user_id, mmcast_episode_id)
  WHERE kind = 'mmcast' AND mmcast_episode_id IS NOT NULL;

INSERT INTO public.mmcast_episodes
  (episode_number, title, guest_name, youtube_url, youtube_video_id, thumbnail_url, short_description, full_description, category, status, published_at)
VALUES
  (1,
   'Ele tem 18 anos e já fatura +€15.000 por mês',
   'Leandro Santana',
   'https://www.youtube.com/watch?v=u2xOrBEmeNA',
   'u2xOrBEmeNA',
   'https://i.ytimg.com/vi/u2xOrBEmeNA/hqdefault.jpg',
   'Aos 18 anos, o Leandro Santana já fatura mais de €15.000 por mês. Uma conversa sobre começar cedo, foco e execução.',
   'Aos 18 anos, o Leandro Santana já fatura mais de €15.000 por mês. Neste primeiro episódio do MMCast, o Victor Muabi conversa com ele sobre o percurso, as decisões que o trouxeram até aqui, os erros, as estratégias e o que é preciso para construir resultados tão cedo.',
   'Empreendedorismo',
   'published',
   '2026-11-05T18:00:00+00'),
  (2,
   'Chegou a Portugal aos 13 e teve de controlar cada euro',
   'Pablo Mendes',
   'https://www.youtube.com/watch?v=sF-vY6ogoEI',
   'sF-vY6ogoEI',
   'https://i.ytimg.com/vi/sF-vY6ogoEI/hqdefault.jpg',
   'O Pablo Mendes chegou a Portugal aos 13 anos e teve de aprender a controlar cada euro. Uma história de resiliência e construção.',
   'O Pablo Mendes chegou a Portugal aos 13 anos e teve de aprender a controlar cada euro. Neste episódio do MMCast, partilha a sua história, os desafios de recomeçar num país novo, as estratégias que usou para crescer e as lições que ficam para quem está a construir o seu caminho.',
   'Empreendedorismo',
   'published',
   '2026-11-12T18:00:00+00');