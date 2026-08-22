CREATE TABLE public.learning_activity (
  user_id uuid NOT NULL,
  day date NOT NULL,
  minutes integer NOT NULL DEFAULT 0,
  lessons_completed integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
GRANT SELECT, INSERT, UPDATE ON public.learning_activity TO authenticated;
GRANT ALL ON public.learning_activity TO service_role;
ALTER TABLE public.learning_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activity read" ON public.learning_activity FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own activity write" ON public.learning_activity FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own activity update" ON public.learning_activity FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.lesson_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  course_id text NOT NULL,
  lesson_id text NOT NULL,
  seconds integer NOT NULL DEFAULT 0,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lesson_notes_user_lesson_idx ON public.lesson_notes (user_id, course_id, lesson_id, seconds);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_notes TO authenticated;
GRANT ALL ON public.lesson_notes TO service_role;
ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notes" ON public.lesson_notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.course_certificates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  course_id text NOT NULL,
  course_title text NOT NULL,
  member_name text NOT NULL,
  code text NOT NULL UNIQUE,
  hours numeric NOT NULL DEFAULT 0,
  lessons_total integer NOT NULL DEFAULT 0,
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);
GRANT SELECT ON public.course_certificates TO authenticated;
GRANT ALL ON public.course_certificates TO service_role;
ALTER TABLE public.course_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own certificates" ON public.course_certificates FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "staff certificates" ON public.course_certificates FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE OR REPLACE FUNCTION public.record_learning_activity(_minutes integer DEFAULT 0, _lessons integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  INSERT INTO public.learning_activity (user_id, day, minutes, lessons_completed, updated_at)
  VALUES (uid, (now() AT TIME ZONE 'Europe/Lisbon')::date, GREATEST(COALESCE(_minutes,0),0), GREATEST(COALESCE(_lessons,0),0), now())
  ON CONFLICT (user_id, day) DO UPDATE
    SET minutes = public.learning_activity.minutes + GREATEST(COALESCE(_minutes,0),0),
        lessons_completed = public.learning_activity.lessons_completed + GREATEST(COALESCE(_lessons,0),0),
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.my_learning_streak()
RETURNS TABLE(current_streak integer, longest_streak integer, week_minutes integer, total_minutes integer, active_days date[], last_active_day date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  today date := (now() AT TIME ZONE 'Europe/Lisbon')::date;
  d date;
  cur integer := 0;
  best integer := 0;
  run integer := 0;
  prev date;
  days date[];
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  SELECT array_agg(day ORDER BY day) INTO days
  FROM public.learning_activity WHERE user_id = uid AND minutes > 0;
  days := COALESCE(days, ARRAY[]::date[]);

  prev := NULL;
  FOREACH d IN ARRAY days LOOP
    IF prev IS NOT NULL AND d = prev + 1 THEN run := run + 1; ELSE run := 1; END IF;
    IF run > best THEN best := run; END IF;
    prev := d;
  END LOOP;

  IF prev IS NOT NULL AND (prev = today OR prev = today - 1) THEN cur := run; ELSE cur := 0; END IF;

  RETURN QUERY
  SELECT cur,
         best,
         COALESCE((SELECT SUM(minutes)::int FROM public.learning_activity WHERE user_id = uid AND day >= today - 6), 0),
         COALESCE((SELECT SUM(minutes)::int FROM public.learning_activity WHERE user_id = uid), 0),
         days,
         prev;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_course_certificate(_course_id text, _course_title text, _hours numeric, _lessons_total integer)
RETURNS TABLE(code text, issued_at timestamptz, member_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  nm text;
  existing public.course_certificates;
  newcode text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO existing FROM public.course_certificates WHERE user_id = uid AND course_id = _course_id;
  IF existing.id IS NOT NULL THEN
    RETURN QUERY SELECT existing.code, existing.issued_at, existing.member_name;
    RETURN;
  END IF;
  SELECT COALESCE(NULLIF(p.display_name, ''), 'Membro MM Club') INTO nm FROM public.profiles p WHERE p.id = uid;
  nm := COALESCE(nm, 'Membro MM Club');
  newcode := 'MM-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
  INSERT INTO public.course_certificates (user_id, course_id, course_title, member_name, code, hours, lessons_total)
  VALUES (uid, _course_id, _course_title, nm, newcode, GREATEST(COALESCE(_hours,0),0), GREATEST(COALESCE(_lessons_total,0),0));
  RETURN QUERY SELECT newcode, now()::timestamptz, nm;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_certificate(_code text)
RETURNS TABLE(member_name text, course_title text, hours numeric, issued_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.member_name, c.course_title, c.hours, c.issued_at
  FROM public.course_certificates c
  WHERE upper(c.code) = upper(trim(_code))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_learning_activity(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_learning_streak() TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_course_certificate(text, text, numeric, integer) TO authenticated;