ALTER TABLE public.service_applications ADD COLUMN lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX service_applications_lead_id_unique ON public.service_applications(lead_id) WHERE lead_id IS NOT NULL;
REVOKE UPDATE ON public.service_applications FROM authenticated;
CREATE FUNCTION public.manage_service_call(_id uuid, _status text, _at timestamptz DEFAULT NULL, _closer uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req public.service_applications; lead public.leads; actor uuid := auth.uid(); closer_name text; lead_status text;
BEGIN
 IF actor IS NULL OR NOT public.has_commercial_access(actor) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
 IF _status NOT IN ('novo','em_contacto','call_marcada','concluido','descartado') OR _status IS NULL THEN RAISE EXCEPTION 'Estado inválido.'; END IF;
 SELECT * INTO req FROM public.service_applications WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
 IF req.lead_id IS NOT NULL THEN
  SELECT * INTO lead FROM public.leads WHERE id=req.lead_id FOR UPDATE;
  IF lead.responsavel_id IS NOT NULL AND lead.responsavel_id <> actor AND NOT (_status='call_marcada' AND lead.status='call_marcada' AND lead.call_scheduled_by=actor) THEN RAISE EXCEPTION 'Este pedido já tem outro responsável.'; END IF;
  IF lead.status='fechou' THEN RAISE EXCEPTION 'A venda já foi fechada no CRM.'; END IF;
 END IF;
 IF _status='call_marcada' THEN
  IF NOT (public.has_role(actor,'admin') OR public.has_role(actor,'sdr')) THEN RAISE EXCEPTION 'Só SDR ou admin pode marcar calls.'; END IF;
  IF _at IS NULL OR _at <= now() THEN RAISE EXCEPTION 'Escolhe uma data e hora futuras.'; END IF;
  IF _closer IS NULL OR NOT public.has_role(_closer,'closer') THEN RAISE EXCEPTION 'Escolhe um closer válido.'; END IF;
  SELECT display_name INTO closer_name FROM public.profiles WHERE id=_closer;
  IF req.lead_id IS NULL THEN
   INSERT INTO public.leads(nome,email,whatsapp,o_que_travou,utm_source,status) VALUES(req.full_name,req.email,req.phone,concat('Serviço: ',req.service,E'\n',req.message),'servico_'||req.service,'novo') RETURNING * INTO lead;
   UPDATE public.service_applications SET lead_id=lead.id WHERE id=_id;
  END IF;
  UPDATE public.leads SET status='call_marcada',responsavel_id=_closer,responsavel=coalesce(closer_name,'Closer'),call_scheduled_at=_at,call_scheduled_by=actor,call_booked_at=coalesce(call_booked_at,now()),call_reminder_day_sent_at=NULL,call_reminder_hour_sent_at=NULL,updated_at=now() WHERE id=lead.id;
 ELSE
  IF _at IS NOT NULL OR _closer IS NOT NULL THEN RAISE EXCEPTION 'Data e closer apenas ao marcar call.'; END IF;
  IF req.lead_id IS NOT NULL THEN
   IF _status='concluido' THEN RAISE EXCEPTION 'Regista o fecho e o valor nas Aplicações.'; END IF;
   lead_status := CASE _status WHEN 'em_contacto' THEN 'em_contato' WHEN 'descartado' THEN 'perdido' ELSE 'novo' END;
   UPDATE public.leads SET status=lead_status,call_scheduled_at=NULL,updated_at=now() WHERE id=req.lead_id;
  END IF;
 END IF;
 UPDATE public.service_applications SET status=_status WHERE id=_id;
 RETURN coalesce(lead.id,req.lead_id);
END $$;
REVOKE ALL ON FUNCTION public.manage_service_call(uuid,text,timestamptz,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_service_call(uuid,text,timestamptz,uuid) TO authenticated;
CREATE FUNCTION public.sync_service_lead_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 UPDATE public.service_applications SET status=CASE NEW.status WHEN 'call_marcada' THEN 'call_marcada' WHEN 'fechou' THEN 'concluido' WHEN 'perdido' THEN 'descartado' WHEN 'em_contato' THEN 'em_contacto' ELSE 'novo' END WHERE lead_id=NEW.id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_service_lead_status() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER service_lead_status_sync AFTER UPDATE OF status ON public.leads FOR EACH ROW EXECUTE FUNCTION public.sync_service_lead_status();