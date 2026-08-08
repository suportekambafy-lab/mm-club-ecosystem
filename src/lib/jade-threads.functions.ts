import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AiThread = {
  id: string;
  title: string;
  updated_at: string;
};

export type AiMessageRow = {
  id: string;
  client_id: string | null;
  role: "user" | "assistant" | "system";
  parts: Array<{ type: string; text?: string }>;
  created_at: string;
};

/** Tabelas novas (ai_threads / ai_messages) ainda não estão nos tipos gerados. */
function db(client: unknown) {
  return client as {
    from: (t: string) => any;
  };
}

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await db(context.supabase)
      .from("ai_threads")
      .select("id, title, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as AiThread[];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await db(context.supabase)
      .from("ai_threads")
      .insert({ user_id: context.userId, title: "Nova conversa" })
      .select("id, title, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return data as AiThread;
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { threadId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await db(context.supabase)
      .from("ai_threads")
      .delete()
      .eq("id", data.threadId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { threadId: string; title: string }) => input)
  .handler(async ({ data, context }) => {
    const title = data.title.trim().slice(0, 120) || "Nova conversa";
    const { error } = await db(context.supabase)
      .from("ai_threads")
      .update({ title })
      .eq("id", data.threadId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { threadId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: thread } = await db(context.supabase)
      .from("ai_threads")
      .select("id, title, updated_at")
      .eq("id", data.threadId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!thread) return null;

    const { data: rows, error } = await db(context.supabase)
      .from("ai_messages")
      .select("id, client_id, role, parts, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    return {
      thread: thread as AiThread,
      messages: (rows ?? []) as AiMessageRow[],
    };
  });
