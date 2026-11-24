import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bucketRevenue, dayWindow, monthlyGoalEurCents, monthlyWindow, previousMonthWindow, summarizeGoal } from "./goal-rules";

const BATCH = 500;

async function collect<T>(fetch: (offset: number, limit: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += BATCH) {
    const { data, error } = await fetch(offset, BATCH);
    if (error) throw new Error("Não foi possível consultar as vendas.");
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < BATCH) break;
  }
  return rows;
}

type Ctx = { supabase: any; userId: string };
async function assertCommercial(context: Ctx) {
  const { data: allowed, error } = await context.supabase.rpc("has_commercial_access", { _user_id: context.userId });
  if (error || !allowed) throw new Error("Sem permissão.");
}

async function goalsFor(db: any, monthKey: string) {
  const { data } = await db.from("commercial_goals").select("revenue_goal_cents, sdr_daily_calls, closer_daily_closes").eq("month_key", monthKey).maybeSingle();
  return {
    revenueGoalCents: Number(data?.revenue_goal_cents ?? monthlyGoalEurCents(monthKey)),
    sdrDailyCalls: data?.sdr_daily_calls ?? 5,
    closerDailyCloses: data?.closer_daily_closes ?? 1,
  };
}

/** Vendas confirmadas: meta do mês e faturamento hoje / 7 dias / mês / mês anterior. */
export const monthlyGoalProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCommercial(context);
    const now = new Date();
    const window = monthlyWindow(now);
    const from = previousMonthWindow(now).startIso, to = window.endIso;
    const db = context.supabase;

    const [closed, payments, charges, goals] = await Promise.all([
      collect<{ sale_amount_cents: number | null; sale_closed_at: string }>((o, l) => db.from("leads")
        .select("sale_amount_cents, sale_closed_at").eq("status", "fechou")
        .gte("sale_closed_at", from).lt("sale_closed_at", to).order("id").range(o, o + l - 1)),
      collect<{ amount_cents: number; paid_at: string }>((o, l) => db.from("mmpay_payments")
        .select("amount_cents, paid_at").eq("status", "paid")
        .gte("paid_at", from).lt("paid_at", to).order("id").range(o, o + l - 1)),
      collect<{ amount_cents: number; finished_at: string }>((o, l) => db.from("mmpay_subscription_charges")
        .select("amount_cents, finished_at").eq("status", "paid").gt("cycle_number", 1)
        .gte("finished_at", from).lt("finished_at", to).order("id").range(o, o + l - 1)),
      goalsFor(db, window.monthKey),
    ]);

    const inMonth = (at: string) => at >= window.startIso && at < window.endIso;
    const applicationsCents = closed.filter(r => inMonth(r.sale_closed_at)).reduce((t, r) => t + (r.sale_amount_cents ?? 0), 0);
    const mmpayCents = payments.filter(r => inMonth(r.paid_at)).reduce((t, r) => t + r.amount_cents, 0);
    const recurringCents = charges.filter(r => inMonth(r.finished_at)).reduce((t, r) => t + r.amount_cents, 0);
    const revenueCents = applicationsCents + mmpayCents + recurringCents;
    const periods = bucketRevenue([
      ...closed.map(r => ({ at: r.sale_closed_at, cents: r.sale_amount_cents ?? 0 })),
      ...payments.map(r => ({ at: r.paid_at, cents: r.amount_cents })),
      ...charges.map(r => ({ at: r.finished_at, cents: r.amount_cents })),
    ], now);
    const goalCents = goals.revenueGoalCents;
    return { ...window, goalCents, revenueCents, periods, ...summarizeGoal(revenueCents, goalCents), breakdown: { applicationsCents, mmpayCents, recurringCents } };
  });

/** Metas diárias da equipa: calls marcadas por SDR e fechos por closer hoje. */
export const dailyTeamGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCommercial(context);
    const db = context.supabase;
    const now = new Date();
    const today = dayWindow(now);
    const [goals, roles, calls, closes] = await Promise.all([
      goalsFor(db, monthlyWindow(now).monthKey),
      db.from("user_roles").select("user_id, role").in("role", ["sdr", "closer"]),
      db.from("leads").select("call_scheduled_by").gte("call_booked_at", today.startIso).lt("call_booked_at", today.endIso).limit(2000),
      db.from("leads").select("sale_closed_by").eq("status", "fechou").gte("sale_closed_at", today.startIso).lt("sale_closed_at", today.endIso).limit(2000),
    ]);
    const roleRows = (roles.data ?? []) as { user_id: string; role: string }[];
    const ids = [...new Set(roleRows.map(r => r.user_id))];
    const { data: profiles } = ids.length ? await db.from("profiles").select("id, display_name").in("id", ids) : { data: [] };
    const name = (id: string) => (profiles ?? []).find((p: any) => p.id === id)?.display_name ?? "Membro";
    const count = (rows: any[] | null, key: string, id: string) => (rows ?? []).filter(r => r[key] === id).length;
    return {
      goals,
      sdrs: roleRows.filter(r => r.role === "sdr").map(r => ({ id: r.user_id, name: name(r.user_id), done: count(calls.data, "call_scheduled_by", r.user_id) })),
      closers: roleRows.filter(r => r.role === "closer").map(r => ({ id: r.user_id, name: name(r.user_id), done: count(closes.data, "sale_closed_by", r.user_id) })),
    };
  });

export const goalsSchema = z.object({
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
  revenueGoalCents: z.number().int().min(0).max(1_000_000_000),
  sdrDailyCalls: z.number().int().min(0).max(500),
  closerDailyCloses: z.number().int().min(0).max(500),
});

export const getCommercialGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ monthKey: z.string().regex(/^\d{4}-\d{2}$/) }).parse(i))
  .handler(async ({ context, data }) => {
    await assertCommercial(context);
    return goalsFor(context.supabase, data.monthKey);
  });

/** Só administradores (Victor) definem as metas. */
export const saveCommercialGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => goalsSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Só o administrador pode definir metas.");
    const { error } = await context.supabase.from("commercial_goals").upsert({
      month_key: data.monthKey, revenue_goal_cents: data.revenueGoalCents,
      sdr_daily_calls: data.sdrDailyCalls, closer_daily_closes: data.closerDailyCloses,
      updated_by: context.userId, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Não foi possível guardar as metas.");
    return { ok: true };
  });

/** Faturamento confirmado num intervalo escolhido (mesmas fontes da meta mensal). */
export const revenueInRange = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ fromIso: z.string().datetime(), toIso: z.string().datetime() }).parse(d))
  .handler(async ({ context, data: { fromIso: from, toIso: to } }) => {
    await assertCommercial(context);
    const db = context.supabase;
    const [closed, payments, charges] = await Promise.all([
      collect<{ sale_amount_cents: number | null }>((o, l) => db.from("leads").select("sale_amount_cents").eq("status", "fechou").gte("sale_closed_at", from).lt("sale_closed_at", to).order("id").range(o, o + l - 1)),
      collect<{ amount_cents: number }>((o, l) => db.from("mmpay_payments").select("amount_cents").eq("status", "paid").gte("paid_at", from).lt("paid_at", to).order("id").range(o, o + l - 1)),
      collect<{ amount_cents: number }>((o, l) => db.from("mmpay_subscription_charges").select("amount_cents").eq("status", "paid").gt("cycle_number", 1).gte("finished_at", from).lt("finished_at", to).order("id").range(o, o + l - 1)),
    ]);
    const applicationsCents = closed.reduce((t, r) => t + (r.sale_amount_cents ?? 0), 0);
    const mmpayCents = payments.reduce((t, r) => t + r.amount_cents, 0);
    const recurringCents = charges.reduce((t, r) => t + r.amount_cents, 0);
    return { totalCents: applicationsCents + mmpayCents + recurringCents, applicationsCents, mmpayCents, recurringCents, sales: closed.length + payments.length + charges.length };
  });
