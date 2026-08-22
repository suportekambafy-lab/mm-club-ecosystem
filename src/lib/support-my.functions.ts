/**
 * MM Suporte — leitura da própria conversa do membro, para poder continuar
 * onde ficou quando volta a abrir o widget.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MySupportMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export const getMySupportConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MySupportMessage[]> => {
    const { data: thread } = await context.supabase
      .from("support_threads")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!thread) return [];

    const { data, error } = await context.supabase
      .from("support_messages")
      .select("id, role, content, created_at")
      .eq("thread_id", (thread as { id: string }).id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw error;

    return ((data ?? []) as MySupportMessage[]).filter(
      (m) => (m.role === "user" || m.role === "assistant") && !!m.content,
    );
  });
