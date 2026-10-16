import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classificar } from "./config";
import { leadSchema } from "./validation";
import { leadUpdateSchema } from "./sale-rules";

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** Público: guarda o lead parcial ou final. O id funciona como chave da sessão. */
export const saveLead = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => leadSchema.parse(i))
  .handler(async ({ data }) => {
    const db = await admin();
    const { id, final, ...fields } = data;
    const row: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
    if (final) {
      row.classificacao = classificar(fields as Record<string, string | undefined>);
      row.status = "novo";
    }
    if (id) {
      const { data: ex } = await db.from("leads").select("id, status").eq("id", id).maybeSingle();
      if (ex) {
        if (!final && ex.status !== "incompleto") delete row.status;
        const { error } = await db.from("leads").update(row as never).eq("id", id);
        if (error) throw new Error("Não foi possível guardar.");
        return { id, classificacao: (row.classificacao as string) ?? null };
      }
    }
    const { data: ins, error } = await db.from("leads").insert({ ...row, status: final ? "novo" : "incompleto" } as never).select("id").single();
    if (error) throw new Error("Não foi possível guardar.");
    return { id: ins.id as string, classificacao: (row.classificacao as string) ?? null };
  });

// ---------- Admin ----------
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

async function assertCommercial(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_commercial_access", { _user_id: ctx.userId });
  if (error || !data) throw new Error("Forbidden");
}

export const listApplicationNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCommercial(context);
    const { data, error } = await context.supabase.from("leads")
      .select("id, nome, classificacao").not("classificacao", "is", null)
      .order("updated_at", { ascending: false }).limit(2000);
    if (error) throw new Error("Não foi possível consultar as aplicações.");
    return data ?? [];
  });

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCommercial(context);
    const since = new Date(Date.now() - 90 * 86400_000).toISOString();
    const [{ data: leads }, { data: ag }, { data: cfg }] = await Promise.all([
      context.supabase.from("leads").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(2000),
      context.supabase.from("agendamentos").select("lead_id, data_hora"),
      context.supabase.from("aplicacao_settings").select("slots, blocked_days").eq("id", 1).maybeSingle(),
    ]);
    return { leads: leads ?? [], agendamentos: ag ?? [], settings: cfg, me: context.userId };
  });

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => leadUpdateSchema.parse(i))
  .handler(async ({ context, data }) => {
    await assertCommercial(context);
    const db = await admin();
    const { data: lead } = await db.from("leads").select("responsavel_id").eq("id", data.id).maybeSingle();
    if (!lead) throw new Error("Lead não encontrado.");
    if (lead.responsavel_id && lead.responsavel_id !== context.userId)
      throw new Error("Este lead já foi assumido por outra pessoa.");
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.status) patch.status = data.status;
    if (data.status === "fechou") patch.sale_amount_cents = data.saleAmountCents;
    if (data.assumir) {
      const { data: p } = await db.from("profiles").select("display_name").eq("id", context.userId).maybeSingle();
      patch.responsavel = p?.display_name ?? "Equipa";
      patch.responsavel_id = context.userId;
    }
    let q = db.from("leads").update(patch as never).eq("id", data.id);
    if (data.assumir) q = q.is("responsavel_id", null);
    const { data: updated, error } = await q.select("*").maybeSingle();
    if (error) throw new Error("Não foi possível atualizar.");
    if (!updated) throw new Error("O lead não foi atualizado. Volta a abrir a aplicação.");
    return { ok: true, lead: updated };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      slots: z.array(z.string().regex(/^\d{2}:\d{2}$/)).max(48),
      blocked_days: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(366),
    }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("aplicacao_settings")
      .update({ ...data, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) throw new Error("Não foi possível guardar.");
    return { ok: true };
  });
