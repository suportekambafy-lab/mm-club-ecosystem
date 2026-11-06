import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { monthlyGoalEurCents, monthlyWindow, summarizeGoal } from "./goal-rules";

const BATCH = 500;

async function collect<T>(fetch: (offset: number, limit: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += BATCH) {
    const { data, error } = await fetch(offset, BATCH);
    if (error) throw new Error("Não foi possível consultar as vendas do mês.");
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < BATCH) break;
  }
  return rows;
}

const sum = (rows: { [key: string]: number | null }[], column: string) =>
  rows.reduce((total, row) => total + (row[column] ?? 0), 0);

/** Vendas confirmadas do mês no fuso de Lisboa, face ao objetivo do mês. */
export const monthlyGoalProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed, error: permissionError } = await context.supabase.rpc("has_commercial_access", { _user_id: context.userId });
    if (permissionError || !allowed) throw new Error("Sem permissão para consultar a meta do mês.");

    const window = monthlyWindow(new Date());
    const db = context.supabase;

    const [closed, payments, charges] = await Promise.all([
      collect<{ sale_amount_cents: number | null }>((offset, limit) => db.from("leads")
        .select("sale_amount_cents").eq("status", "fechou")
        .gte("sale_closed_at", window.startIso).lt("sale_closed_at", window.endIso)
        .order("sale_closed_at", { ascending: false }).order("id").range(offset, offset + limit - 1)),
      collect<{ amount_cents: number }>((offset, limit) => db.from("mmpay_payments")
        .select("amount_cents").eq("status", "paid")
        .gte("paid_at", window.startIso).lt("paid_at", window.endIso)
        .order("id").range(offset, offset + limit - 1)),
      collect<{ amount_cents: number }>((offset, limit) => db.from("mmpay_subscription_charges")
        .select("amount_cents").eq("status", "paid").gt("cycle_number", 1)
        .gte("finished_at", window.startIso).lt("finished_at", window.endIso)
        .order("id").range(offset, offset + limit - 1)),
    ]);

    const applicationsCents = sum(closed, "sale_amount_cents");
    const mmpayCents = sum(payments, "amount_cents");
    const recurringCents = sum(charges, "amount_cents");
    const revenueCents = applicationsCents + mmpayCents + recurringCents;
    const goalCents = monthlyGoalEurCents(window.monthKey);

    return { ...window, goalCents, revenueCents, ...summarizeGoal(revenueCents, goalCents), breakdown: { applicationsCents, mmpayCents, recurringCents } };
  });
