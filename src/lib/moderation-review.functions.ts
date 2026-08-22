/**
 * Revisão humana do agente de moderação:
 * - membros contestam a sanção (recurso com contexto e anexo);
 * - admins/moderadores revêem as ações do agente, vêem evidências,
 *   revertem decisões e decidem recursos.
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

/* ---------------- Membro: recurso ---------------- */

export type MyAppeal = {
  id: string;
  sanction_id: string;
  message: string;
  attachment_url: string | null;
  status: string;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
};

/** Recursos do próprio membro (mais recente primeiro). */
export const listMyAppeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyAppeal[]> => {
    const { data, error } = await context.supabase
      .from("moderation_appeals")
      .select("id, sanction_id, message, attachment_url, status, decision_note, created_at, decided_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return (data ?? []) as MyAppeal[];
  });

const AppealInput = z.object({
  sanctionId: z.string().uuid(),
  message: z.string().trim().min(20).max(2000),
  attachmentUrl: z.string().url().max(600).nullable().default(null),
});

/** Submete um recurso contra uma sanção ativa do próprio membro. */
export const submitAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AppealInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("moderation_appeals").insert({
      sanction_id: data.sanctionId,
      user_id: context.userId,
      message: data.message,
      attachment_url: data.attachmentUrl,
    });
    if (error) {
      // A política de RLS bloqueia recursos duplicados ou sanções alheias/levantadas.
      throw new Error(
        "Não foi possível registar o recurso. Confirma que a sanção está ativa e que ainda não tens um recurso em análise.",
      );
    }
    return { ok: true };
  });

/* ---------------- Staff: painel de revisão ---------------- */

export type ModerationActionRow = {
  id: string;
  kind: string;
  target_id: string;
  author_id: string | null;
  author_name: string | null;
  author_avatar: string | null;
  action: string;
  category: string | null;
  severity: string | null;
  reason: string | null;
  excerpt: string | null;
  image_url: string | null;
  created_at: string;
  reverted_at: string | null;
  review_note: string | null;
  sanction: {
    id: string;
    kind: string;
    level: number;
    permanent: boolean;
    expires_at: string | null;
    lifted_at: string | null;
  } | null;
  appeal: {
    id: string;
    status: string;
    message: string;
    attachment_url: string | null;
    created_at: string;
  } | null;
};

const ListInput = z.object({
  status: z.enum(["all", "removed", "allowed", "reverted", "appealed"]).default("all"),
  search: z.string().trim().max(120).default(""),
  limit: z.number().int().min(10).max(200).default(60),
});

/** Histórico do agente com evidências, sanção associada e recurso pendente. */
export const listModerationActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<ModerationActionRow[]> => {
    await assertStaff(context);

    let q = context.supabase
      .from("moderation_actions")
      .select(
        "id, kind, target_id, author_id, action, category, severity, reason, excerpt, image_url, created_at, reverted_at, review_note, sanction_id",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.status === "removed") q = q.eq("action", "remove").is("reverted_at", null);
    if (data.status === "allowed") q = q.eq("action", "allow");
    if (data.status === "reverted") q = q.not("reverted_at", "is", null);
    if (data.search) q = q.or(`excerpt.ilike.%${data.search}%,reason.ilike.%${data.search}%`);

    const { data: rows, error } = await q;
    if (error) throw error;
    const list = (rows ?? []) as any[];

    const authorIds = [...new Set(list.map((r) => r.author_id).filter(Boolean))] as string[];
    const sanctionIds = [...new Set(list.map((r) => r.sanction_id).filter(Boolean))] as string[];

    const [profiles, sanctions] = await Promise.all([
      authorIds.length
        ? context.supabase.from("profiles").select("id, display_name, avatar_url").in("id", authorIds)
        : Promise.resolve({ data: [] as any[] }),
      sanctionIds.length
        ? context.supabase
            .from("community_sanctions")
            .select("id, kind, level, permanent, expires_at, lifted_at")
            .in("id", sanctionIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const appeals = sanctionIds.length
      ? (
          await context.supabase
            .from("moderation_appeals")
            .select("id, sanction_id, status, message, attachment_url, created_at")
            .in("sanction_id", sanctionIds)
            .order("created_at", { ascending: false })
        ).data ?? []
      : [];

    const profileById = new Map((profiles.data ?? []).map((p: any) => [p.id, p]));
    const sanctionById = new Map((sanctions.data ?? []).map((s: any) => [s.id, s]));
    const appealBySanction = new Map<string, any>();
    for (const a of appeals as any[]) {
      if (!appealBySanction.has(a.sanction_id)) appealBySanction.set(a.sanction_id, a);
    }

    const mapped: ModerationActionRow[] = list.map((r) => {
      const profile = r.author_id ? profileById.get(r.author_id) : null;
      const sanction = r.sanction_id ? sanctionById.get(r.sanction_id) : null;
      const appeal = r.sanction_id ? appealBySanction.get(r.sanction_id) : null;
      return {
        id: r.id,
        kind: r.kind,
        target_id: r.target_id,
        author_id: r.author_id,
        author_name: (profile?.display_name as string | undefined) ?? null,
        author_avatar: (profile?.avatar_url as string | undefined) ?? null,
        action: r.action,
        category: r.category,
        severity: r.severity,
        reason: r.reason,
        excerpt: r.excerpt,
        image_url: r.image_url,
        created_at: r.created_at,
        reverted_at: r.reverted_at,
        review_note: r.review_note,
        sanction: sanction
          ? {
              id: sanction.id,
              kind: sanction.kind,
              level: sanction.level,
              permanent: sanction.permanent,
              expires_at: sanction.expires_at,
              lifted_at: sanction.lifted_at,
            }
          : null,
        appeal: appeal
          ? {
              id: appeal.id,
              status: appeal.status,
              message: appeal.message,
              attachment_url: appeal.attachment_url,
              created_at: appeal.created_at,
            }
          : null,
      };
    });

    return data.status === "appealed"
      ? mapped.filter((r) => r.appeal?.status === "pending")
      : mapped;
  });

const RevertInput = z.object({
  actionId: z.string().uuid(),
  note: z.string().trim().max(500).default(""),
});

/**
 * Reverte a decisão do agente: levanta a sanção associada, marca a ação como
 * revertida e avisa o membro. O conteúdo removido não é restaurado.
 */
export const revertModerationAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RevertInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);

    const { data: action, error } = await context.supabase
      .from("moderation_actions")
      .select("id, author_id, sanction_id")
      .eq("id", data.actionId)
      .maybeSingle();
    if (error || !action) throw new Error("Ação não encontrada.");

    await context.supabase
      .from("moderation_actions")
      .update({
        reverted_at: new Date().toISOString(),
        reverted_by: context.userId,
        review_note: data.note || null,
      })
      .eq("id", data.actionId);

    if (action.sanction_id) {
      await context.supabase
        .from("community_sanctions")
        .update({ lifted_at: new Date().toISOString() })
        .eq("id", action.sanction_id)
        .is("lifted_at", null);
    }

    if (action.author_id) {
      await context.supabase.from("notifications").insert({
        user_id: action.author_id,
        kind: "appeal",
        course_id: "recurso-aceite",
      });
    }

    return { ok: true };
  });

const DecideInput = z.object({
  appealId: z.string().uuid(),
  decision: z.enum(["accepted", "rejected"]),
  note: z.string().trim().max(500).default(""),
});

/** Decide um recurso; aceitar levanta a sanção de imediato. */
export const decideAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DecideInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);

    const { data: appeal, error } = await context.supabase
      .from("moderation_appeals")
      .select("id, sanction_id, user_id, status")
      .eq("id", data.appealId)
      .maybeSingle();
    if (error || !appeal) throw new Error("Recurso não encontrado.");

    await context.supabase
      .from("moderation_appeals")
      .update({
        status: data.decision,
        decision_note: data.note || null,
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.appealId);

    if (data.decision === "accepted") {
      await context.supabase
        .from("community_sanctions")
        .update({ lifted_at: new Date().toISOString() })
        .eq("id", appeal.sanction_id)
        .is("lifted_at", null);
      await context.supabase
        .from("moderation_actions")
        .update({
          reverted_at: new Date().toISOString(),
          reverted_by: context.userId,
          review_note: data.note || "Recurso aceite.",
        })
        .eq("sanction_id", appeal.sanction_id);
    }

    await context.supabase.from("notifications").insert({
      user_id: appeal.user_id,
      kind: "appeal",
      course_id: data.decision === "accepted" ? "recurso-aceite" : "recurso-recusado",
    });

    return { ok: true };
  });
