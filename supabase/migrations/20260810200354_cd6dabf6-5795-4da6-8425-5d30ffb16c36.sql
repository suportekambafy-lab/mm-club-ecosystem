ALTER TABLE public.live_chat_messages ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.live_chat_messages ADD COLUMN IF NOT EXISTS guest_id uuid;
ALTER TABLE public.live_chat_messages ADD COLUMN IF NOT EXISTS guest_name text;
ALTER TABLE public.live_chat_messages DROP CONSTRAINT IF EXISTS live_chat_author_present;
ALTER TABLE public.live_chat_messages ADD CONSTRAINT live_chat_author_present CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL);