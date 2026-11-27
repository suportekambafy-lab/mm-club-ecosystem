import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { serviceUpdateSchema } from "./call-rules";

export const listServiceRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed, error: authError } = await context.supabase.rpc("has_commercial_access", { _user_id: context.userId });
    if (authError || !allowed) throw new Error("Sem permissão.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [{ data: requests, error }, { data: roles }] = await Promise.all([
      context.supabase.from("service_applications").select("*").order("created_at", { ascending: false }),
      db.from("user_roles").select("user_id,role").in("role", ["admin", "sdr", "closer"]),
    ]);
    if (error) throw new Error("Não foi possível consultar os pedidos.");
    const leadIds = (requests ?? []).flatMap(r => r.lead_id ? [r.lead_id] : []);
    const { data: leads, error: leadError } = leadIds.length ? await context.supabase.from("leads").select("id,status,responsavel_id,responsavel,call_scheduled_at,call_scheduled_by,sale_closed_by").in("id", leadIds) : { data: [], error: null };
    if (leadError) throw new Error("Não foi possível consultar as calls.");
    const profileIds = [...new Set([...(roles ?? []).map(r => r.user_id), ...(leads ?? []).flatMap(l => l.call_scheduled_by ? [l.call_scheduled_by] : [])])];
    const { data: profiles } = profileIds.length ? await db.from("profiles").select("id,display_name").in("id", profileIds) : { data: [] };
    const names = Object.fromEntries((profiles ?? []).map(p => [p.id, p.display_name ?? "Equipa"]));
    return { requests: (requests ?? []).map(r => ({ ...r, lead: (leads ?? []).find(l => l.id === r.lead_id) ?? null })), me: context.userId, roles: (roles ?? []).filter(r => r.user_id === context.userId).map(r => r.role), names, closers: (roles ?? []).filter(r => r.role === "closer").map(r => ({ id: r.user_id, name: names[r.user_id] ?? "Closer" })).sort((a,b) => a.name.localeCompare(b.name)) };
  });

export const updateServiceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => serviceUpdateSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: leadId, error } = await context.supabase.rpc("manage_service_call", {
      _id: data.id, _status: data.status,
      ...(data.status === "call_marcada" ? { _at: data.callScheduledAt, _closer: data.closerId } : {}),
    });
    if (error) throw new Error(error.message);
    if (data.status === "call_marcada" && leadId) {
      const { data: lead } = await context.supabase.from("leads").select("id,nome,responsavel_id,call_scheduled_at").eq("id", leadId).maybeSingle();
      if (lead) {
        const { sendCallConfirmation } = await import("@/lib/aplicacao/call-confirmation.server");
        await sendCallConfirmation(lead);
      }
    }
    return { ok: true, leadId };
  });