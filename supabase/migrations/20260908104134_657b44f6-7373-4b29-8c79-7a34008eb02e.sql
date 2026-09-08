CREATE OR REPLACE FUNCTION public.issue_course_certificate(_course_id text, _course_title text, _hours numeric, _lessons_total integer)
 RETURNS TABLE(code text, issued_at timestamp with time zone, member_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
  newcode := 'MM-' || upper(substr(md5(gen_random_uuid()::text), 1, 10));
  INSERT INTO public.course_certificates (user_id, course_id, course_title, member_name, code, hours, lessons_total)
  VALUES (uid, _course_id, _course_title, nm, newcode, GREATEST(COALESCE(_hours,0),0), GREATEST(COALESCE(_lessons_total,0),0));
  RETURN QUERY SELECT newcode, now()::timestamptz, nm;
END;
$function$;

GRANT SELECT ON public.admin_overrides TO anon;
DROP POLICY IF EXISTS "Catalogue overrides readable by visitors" ON public.admin_overrides;
CREATE POLICY "Catalogue overrides readable by visitors"
  ON public.admin_overrides FOR SELECT TO anon USING (true);