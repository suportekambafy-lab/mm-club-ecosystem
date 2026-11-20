CREATE TABLE public.service_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  service text NOT NULL CHECK (service IN ('loja_pronta','consultoria_1h','mentoria_individual')),
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  email text NOT NULL CHECK (char_length(email) BETWEEN 5 AND 255),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 6 AND 40),
  message text CHECK (message IS NULL OR char_length(message) <= 1000),
  status text NOT NULL DEFAULT 'novo',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.service_applications TO authenticated;
GRANT ALL ON public.service_applications TO service_role;
ALTER TABLE public.service_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own insert" ON public.service_applications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own or admin read" ON public.service_applications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));