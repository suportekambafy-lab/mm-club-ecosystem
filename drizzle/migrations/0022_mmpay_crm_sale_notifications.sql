CREATE OR REPLACE FUNCTION public.queue_mmpay_crm_sale() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status <> 'paid' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN IF OLD.status='paid' THEN RETURN NEW; END IF; END IF;
 IF TG_TABLE_NAME='mmpay_subscription_charges' THEN
   IF NEW.cycle_number <= 1 THEN RETURN NEW; END IF;
 END IF;
 INSERT INTO public.job_queue(consumer,job_type,payload,max_attempts)
 VALUES('crm','MmpaySaleApproved',jsonb_build_object('paymentId',NEW.id,'source',CASE WHEN TG_TABLE_NAME='mmpay_subscription_charges' THEN 'charge' ELSE 'payment' END),6);
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN
 RAISE WARNING 'Could not queue MMpay CRM sale notification';
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_mmpay_crm_sale() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_mmpay_crm_sale() TO service_role;
CREATE TRIGGER mmpay_crm_payment AFTER INSERT OR UPDATE OF status ON public.mmpay_payments FOR EACH ROW EXECUTE FUNCTION public.queue_mmpay_crm_sale();
CREATE TRIGGER mmpay_crm_recurring AFTER INSERT OR UPDATE OF status ON public.mmpay_subscription_charges FOR EACH ROW EXECUTE FUNCTION public.queue_mmpay_crm_sale();