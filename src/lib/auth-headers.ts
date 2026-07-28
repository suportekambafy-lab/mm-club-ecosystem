import { supabase } from "@/integrations/supabase/client";

/**
 * Bearer header for calls to raw /api/* routes that verify the Supabase
 * session server-side (AI chat, transcription, realtime voice, knowledge).
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
