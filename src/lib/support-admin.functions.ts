/**
 * MM Suporte — leitura das conversas guardadas para a equipa (admin/moderação).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertStaff(context: any) {
  const [{ data: isAdmin }, { data: isMod }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "moderator" }),
  ]);
  if (!isAdmin && !isMod) throw new Error("Forbidden");
}

export type SupportThreadRow = {
  id: string;
  user_id: string;
  last_message_at: string;
  message_count: number;
  escalated: boolean;
  handled: boolean;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  last_message: string | null;
};

export type SupportMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

/** Lista as conversas de suporte, mais recentes primeiro. */
export const listSupportThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SupportThreadRow[]> => {
    await assertStaff(context);

    const { data: threads, error } = await context.supabase
      .from("support_threads")
      .select("id, user_id, last_message_at, message_count, escalated, handled, email")
      .order("last_message_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const rows = (threads ?? []) as Array<{
      id: string;
      user_id: string;
      last_message_at: string;
      message_count: number;
      escalated: boolean;
      handled: boolean;
      email: string | null;
    }>;
    if (rows.length === 0) return [];

    const userIds = rows.map((r) => r.user_id);
    const [{ data: profiles }, { data: lastMessages }] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds),
      context.supabase
        .from("support_messages")
        .select("thread_id, content, created_at, role")
        .in(
          "thread_id",
          rows.map((r) => r.id),
        )
        .order("created_at", { ascending: false })
        .limit(600),
    ]);

    const profileById = new Map<string, any>(
      ((profiles ?? []) as any[]).map((p) => [p.id as string, p]),
    );
    const lastByThread = new Map<string, string>();
    for (const m of (lastMessages ?? []) as any[]) {
      if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m.content as string);
    }

    return rows.map((r) => {
      const p = profileById.get(r.user_id);
      return {
        ...r,
        display_name: (p?.display_name as string | null) ?? null,
        avatar_url: (p?.avatar_url as string | null) ?? null,
        email: (p?.email as string | null) ?? null,
        last_message: lastByThread.get(r.id) ?? null,
      };
    });
  });

/** Mensagens de uma conversa de suporte. */
export const getSupportThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<SupportMessageRow[]> => {
    await assertStaff(context);
    const { data: rows, error } = await context.supabase
      .from("support_messages")
      .select("id, role, content, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw error;
    return (rows ?? []) as SupportMessageRow[];
  });

/** Marca (ou desmarca) uma conversa como tratada pela equipa. */
export const setSupportThreadHandled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ threadId: z.string().uuid(), handled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { error } = await context.supabase
      .from("support_threads")
      .update({ handled: data.handled })
      .eq("id", data.threadId);
    if (error) throw error;
    return { ok: true };
  });
