ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS call_booked_at timestamptz;
UPDATE public.leads SET call_booked_at = updated_at WHERE status = 'call_marcada' AND call_booked_at IS NULL;

CREATE TABLE public.commercial_goals (
  month_key text PRIMARY KEY CHECK (month_key ~ '^\d{4}-\d{2}$'),
  revenue_goal_cents bigint NOT NULL DEFAULT 2000000 CHECK (revenue_goal_cents >= 0),
  sdr_daily_calls integer NOT NULL DEFAULT 5 CHECK (sdr_daily_calls >= 0),
  closer_daily_closes integer NOT NULL DEFAULT 1 CHECK (closer_daily_closes >= 0),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.commercial_goals TO authenticated;
GRANT ALL ON public.commercial_goals TO service_role;
ALTER TABLE public.commercial_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Commercial staff read goals" ON public.commercial_goals FOR SELECT TO authenticated USING (public.has_commercial_access(auth.uid()));
CREATE POLICY "Admins insert goals" ON public.commercial_goals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update goals" ON public.commercial_goals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.commercial_goals (month_key, revenue_goal_cents, sdr_daily_calls, closer_daily_closes) VALUES ('2026-11', 2000000, 5, 1) ON CONFLICT DO NOTHING;