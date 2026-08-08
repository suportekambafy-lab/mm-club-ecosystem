UPDATE public.ai_messages SET client_id = id::text WHERE client_id IS NULL;
ALTER TABLE public.ai_messages ALTER COLUMN client_id SET NOT NULL;
DROP INDEX IF EXISTS public.ai_messages_thread_client_idx;
ALTER TABLE public.ai_messages ADD CONSTRAINT ai_messages_thread_client_key UNIQUE (thread_id, client_id);