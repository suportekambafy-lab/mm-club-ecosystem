import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classificar } from "./config";
import { leadSchema } from "./validation";
import { leadUpdateSchema } from "./sale-rules";
import { canScheduleCall } from "./lead-presentation";

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
    const { data: roleRows } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (!canScheduleCall((roleRows ?? []).map((r: { role: string }) => r.role))) return [];
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
    const db = await admin();
    const [{ data: leads }, { data: ag }, { data: cfg }, { data: roleRows }] = await Promise.all([
      context.supabase.from("leads").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(2000),
      context.supabase.from("agendamentos").select("lead_id, data_hora"),
      context.supabase.from("aplicacao_settings").select("slots, blocked_days").eq("id", 1).maybeSingle(),
      db.from("user_roles").select("user_id, role").in("role", ["admin", "sdr", "closer"]),
    ]);
    const myRoles = (roleRows ?? []).filter(r => r.user_id === context.userId).map(r => r.role as string);
    const closerOnly = !canScheduleCall(myRoles);
    const visibleLeads = closerOnly ? (leads ?? []).filter(l => l.responsavel_id === context.userId) : (leads ?? []);
    const visibleIds = new Set(visibleLeads.map(l => l.id));
    const closerIds = [...new Set((roleRows ?? []).filter(r => r.role === "closer").map(r => r.user_id))];
    const { data: closerProfiles } = closerIds.length ? await db.from("profiles").select("id, display_name").in("id", closerIds) : { data: [] };
    const closers = (closerProfiles ?? []).map(p => ({ id: p.id, name: p.display_name ?? "Closer" })).sort((a, b) => a.name.localeCompare(b.name));
    return { leads: visibleLeads, agendamentos: (ag ?? []).filter(a => !closerOnly || visibleIds.has(a.lead_id)), settings: cfg, me: context.userId, myRoles, closers };
  });

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => leadUpdateSchema.parse(i))
  .handler(async ({ context, data }) => {
    await assertCommercial(context);
    const db = await admin();
    const { data: lead } = await db.from("leads").select("responsavel_id, status, sale_closed_by, sale_closed_at, call_scheduled_by").eq("id", data.id).maybeSingle();
    if (!lead) throw new Error("Lead não encontrado.");
    const reschedulingOwnCall = data.status === "call_marcada" && lead.status === "call_marcada" && lead.call_scheduled_by === context.userId;
    if (lead.responsavel_id && lead.responsavel_id !== context.userId && !reschedulingOwnCall)
      throw new Error("Este lead já foi assumido por outra pessoa.");
    let closerProfileName: string | null = null;
    if (data.status === "call_marcada") {
      const { data: roles } = await db.from("user_roles").select("user_id, role").in("user_id", [context.userId, data.closerId!]);
      const mine = (roles ?? []).filter(r => r.user_id === context.userId).map(r => r.role as string);
      if (!mine.includes("admin") && !mine.includes("sdr")) throw new Error("Só o SDR pode marcar calls.");
      if (!(roles ?? []).some(r => r.user_id === data.closerId && r.role === "closer")) throw new Error("Escolhe um closer válido.");
      const { data: cp } = await db.from("profiles").select("display_name").eq("id", data.closerId!).maybeSingle();
      closerProfileName = cp?.display_name ?? "Closer";
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.status) patch.status = data.status;
    if (data.status === "call_marcada") {
      if (!data.callScheduledAt || Date.parse(data.callScheduledAt) <= Date.now()) throw new Error("Escolhe uma data e hora futuras.");
      patch.call_scheduled_at = data.callScheduledAt;
      patch.call_scheduled_by = context.userId;
      patch.responsavel_id = data.closerId;
      patch.responsavel = closerProfileName;
    } else if (data.status) patch.call_scheduled_at = null;
    if (data.status === "fechou") {
      patch.sale_amount_cents = data.saleAmountCents;
      patch.sale_closed_by = lead.status === "fechou" && lead.sale_closed_by ? lead.sale_closed_by : context.userId;
      patch.sale_closed_at = lead.status === "fechou" && lead.sale_closed_at ? lead.sale_closed_at : new Date().toISOString();
    }
    if (data.assumir || (data.status === "fechou" && !lead.responsavel_id)) {
      const { data: p } = await db.from("profiles").select("display_name").eq("id", context.userId).maybeSingle();
      patch.responsavel = p?.display_name ?? "Equipa";
      patch.responsavel_id = context.userId;
    }
    let q = db.from("leads").update(patch as never).eq("id", data.id);
    q = reschedulingOwnCall ? q.eq("call_scheduled_by", context.userId) : lead.responsavel_id ? q.eq("responsavel_id", lead.responsavel_id) : q.is("responsavel_id", null);
    const { data: updated, error } = await q.select("*").maybeSingle();
    if (error) throw new Error("Não foi possível atualizar.");
    if (!updated) throw new Error("O lead não foi atualizado. Volta a abrir a aplicação.");
    let closerName: string | null = null;
    if (data.status === "fechou") {
      const { data: p } = await db.from("profiles").select("display_name").eq("id", context.userId).maybeSingle();
      closerName = p?.display_name ?? "Equipa";
    }
    if (data.status === "call_marcada" && patch.call_scheduled_at) {
      // Confirmação imediata ao responsável (os lembretes de dia/hora ficam com o agendador).
      try {
        const responsavelId = (patch.responsavel_id as string | undefined) ?? lead.responsavel_id ?? context.userId;
        const { data: userRes } = await db.auth.admin.getUserById(responsavelId);
        const email = userRes?.user?.email;
        if (email) {
          const { data: p } = await db.from("profiles").select("display_name").eq("id", responsavelId).maybeSingle();
          const whenLabel = new Intl.DateTimeFormat("pt-PT", {
            timeZone: "Europe/Lisbon", weekday: "long", day: "numeric", month: "long",
            hour: "2-digit", minute: "2-digit",
          }).format(new Date(patch.call_scheduled_at as string));
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          await sendTemplateEmail("call-reminder", email, {
            templateData: {
              closerName: p?.display_name ?? "Equipa",
              leadName: (updated as Record<string, unknown>).nome ?? "o lead",
              whenLabel: `${whenLabel} (Lisboa)`,
              kind: "confirm",
            },
            idempotencyKey: `call-reminder-confirm-${data.id}-${patch.call_scheduled_at}`,
          });
        }
      } catch (e) {
        console.error("[updateLead] call confirmation email failed:", e);
      }
    }
    return { ok: true, lead: updated, closerName };
  });

export const listMyCalls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCommercial(context);
    const { data, error } = await context.supabase.from("leads")
      .select("id, nome, whatsapp, call_scheduled_at")
      .eq("responsavel_id", context.userId).eq("status", "call_marcada")
      .not("call_scheduled_at", "is", null)
      .gte("call_scheduled_at", new Date(Date.now() - 5 * 60_000).toISOString())
      .order("call_scheduled_at", { ascending: true }).limit(100);
    if (error) throw new Error("Não foi possível consultar as calls.");
    return { me: context.userId, calls: (data ?? []).flatMap(call => call.call_scheduled_at ? [{ ...call, call_scheduled_at: call.call_scheduled_at }] : []) };
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
