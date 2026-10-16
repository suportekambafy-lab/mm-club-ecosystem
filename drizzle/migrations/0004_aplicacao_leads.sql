CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  nome text, whatsapp text, email text, instagram text, pais text, idade text,
  ocupacao text, experiencia text, o_que_travou text, tempo_dia text,
  verba_anuncios text, investimento text, decisao text,
  classificacao text CHECK (classificacao IN ('A','B','C')),
  status text NOT NULL DEFAULT 'incompleto',
  responsavel text, responsavel_id uuid,
  utm_source text, utm_medium text, utm_campaign text, utm_content text
);
GRANT SELECT, UPDATE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read leads" ON public.leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update leads" ON public.leads FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  data_hora timestamptz NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agendamentos TO authenticated;
GRANT ALL ON public.agendamentos TO service_role;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read agendamentos" ON public.agendamentos FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.aplicacao_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  slots text[] NOT NULL DEFAULT ARRAY['10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30'],
  blocked_days date[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.aplicacao_settings (id) VALUES (1);
GRANT SELECT, UPDATE ON public.aplicacao_settings TO authenticated;
GRANT ALL ON public.aplicacao_settings TO service_role;
ALTER TABLE public.aplicacao_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read settings" ON public.aplicacao_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update settings" ON public.aplicacao_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));