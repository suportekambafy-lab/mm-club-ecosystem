import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classificar, lisbonToUtc, proximosDiasUteis } from "./config";

const s = (max = 200) => z.string().trim().max(max).optional().nullable();

const leadSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  final: z.boolean().optional(),
  nome: s(120), whatsapp: s(30), email: z.string().trim().email().max(255).optional().nullable(),
  instagram: s(60), pais: s(), idade: s(), ocupacao: s(), experiencia: s(),
  o_que_travou: s(2000), tempo_dia: s(), verba_anuncios: s(), investimento: s(), decisao: s(),
  utm_source: s(), utm_medium: s(), utm_campaign: s(), utm_content: s(),
});

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
      row.classificacao = classificar(fields);
      row.status = "novo";
    }
    if (id) {
      const { data: ex } = await db.from("leads").select("id, status").eq("id", id).maybeSingle();
      if (ex) {
        if (!final && ex.status !== "incompleto") delete row.status;
        await db.from("leads").update(row).eq("id", id);
        return { id, classificacao: (row.classificacao as string) ?? null };
      }
    }
    const { data: ins, error } = await db.from("leads").insert({ ...row, status: final ? "novo" : "incompleto" }).select("id").single();
    if (error) throw new Error("Não foi possível guardar.");
    return { id: ins.id as string, classificacao: (row.classificacao as string) ?? null };
  });

/** Público: grelha de horários (só datas/horas, nada de dados pessoais). */
export const getSlots = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data: cfg } = await db.from("aplicacao_settings").select("slots, blocked_days").eq("id", 1).maybeSingle();
  const blocked = new Set<string>((cfg?.blocked_days as string[]) ?? []);
  const days = proximosDiasUteis(7).filter((d) => !blocked.has(d));
  const times = ((cfg?.slots as string[]) ?? []).slice().sort();
  const from = lisbonToUtc(days[0] ?? "2000-01-01", "00:00");
  const { data: booked } = await db.from("agendamentos").select("data_hora").gte("data_hora", from);
  const taken = new Set((booked ?? []).map((b) => new Date(b.data_hora as string).toISOString()));
  const now = Date.now();
  return days.map((date) => ({
    date,
    slots: times.map((t) => {
      const iso = lisbonToUtc(date, t);
      return { time: t, iso, free: !taken.has(iso) && new Date(iso).getTime() > now };
    }),
  }));
});

export const bookSlot = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ leadId: z.string().uuid(), iso: z.string().datetime() }).parse(i))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: lead } = await db.from("leads").select("id, classificacao").eq("id", data.leadId).maybeSingle();
    if (!lead || lead.classificacao !== "A") throw new Error("Aplicação não encontrada.");
    const { data: cfg } = await db.from("aplicacao_settings").select("slots, blocked_days").eq("id", 1).maybeSingle();
    const valid = proximosDiasUteis(7)
      .filter((d) => !((cfg?.blocked_days as string[]) ?? []).includes(d))
      .flatMap((d) => ((cfg?.slots as string[]) ?? []).map((t) => lisbonToUtc(d, t)));
    const iso = new Date(data.iso).toISOString();
    if (!valid.includes(iso)) throw new Error("Esse horário já não está disponível.");
    await db.from("agendamentos").delete().eq("lead_id", data.leadId);
    const { error } = await db.from("agendamentos").insert({ lead_id: data.leadId, data_hora: iso });
    if (error) throw new Error("Esse horário acabou de ser ocupado. Escolhe outro.");
    await db.from("leads").update({ status: "call_marcada" }).eq("id", data.leadId);
    return { ok: true };
  });

// ---------- Admin ----------
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
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
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["novo", "incompleto", "em_contato", "call_marcada", "fechou", "perdido"]).optional(),
      assumir: z.boolean().optional(),
    }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: lead } = await context.supabase.from("leads").select("responsavel_id").eq("id", data.id).maybeSingle();
    if (!lead) throw new Error("Lead não encontrado.");
    if (lead.responsavel_id && lead.responsavel_id !== context.userId)
      throw new Error("Este lead já foi assumido por outra pessoa.");
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.status) patch.status = data.status;
    if (data.assumir) {
      const { data: p } = await context.supabase.from("profiles").select("display_name").eq("id", context.userId).maybeSingle();
      patch.responsavel = p?.display_name ?? "Equipa";
      patch.responsavel_id = context.userId;
    }
    let q = context.supabase.from("leads").update(patch).eq("id", data.id);
    if (data.assumir) q = q.is("responsavel_id", null);
    const { error } = await q;
    if (error) throw new Error("Não foi possível atualizar.");
    return { ok: true };
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
