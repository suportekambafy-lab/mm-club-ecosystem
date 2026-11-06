import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PaidSaleNotice } from "./paid-sale-tracker";

export const listPaidSaleNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ since: z.string().datetime().optional() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: allowed, error } = await context.supabase.rpc("has_commercial_access", { _user_id: context.userId });
    if (error || !allowed) throw new Error("Sem permissão.");
    // Cross-team payment summaries are privileged; never expose the billing tables themselves.
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const checkedAt = new Date().toISOString();
    const since = new Date(Math.max(Date.parse(data.since ?? checkedAt) - 300_000, Date.now() - 86400_000)).toISOString();
    const notices: PaidSaleNotice[] = [];
    const batch = 500;
    await Promise.all([
      (async () => {
        for (let offset = 0; ; offset += batch) {
          const { data: rows, error } = await db.from("mmpay_payments")
            .select("id, amount_cents, paid_at, name").eq("status", "paid").eq("currency", "EUR")
            .gt("amount_cents", 0).gte("paid_at", since).order("id").range(offset, offset + batch - 1);
          if (error) throw new Error("Não foi possível consultar as vendas pagas.");
          for (const row of rows ?? []) if (row.paid_at) notices.push({ id: `mmpay:${row.id}`, amount: row.amount_cents, paidAt: row.paid_at, buyer: row.name });
          if (!rows || rows.length < batch) break;
        }
      })(),
      (async () => {
        for (let offset = 0; ; offset += batch) {
          const { data: rows, error } = await db.from("mmpay_subscription_charges")
            .select("id, amount_cents, finished_at").eq("status", "paid").gt("cycle_number", 1)
            .gt("amount_cents", 0).gte("finished_at", since).order("id").range(offset, offset + batch - 1);
          if (error) throw new Error("Não foi possível consultar as prestações pagas.");
          for (const row of rows ?? []) if (row.finished_at) notices.push({ id: `charge:${row.id}`, amount: row.amount_cents, paidAt: row.finished_at });
          if (!rows || rows.length < batch) break;
        }
      })(),
      (async () => {
        for (let offset = 0; ; offset += batch) {
          const { data: rows, error } = await db.from("billing_payments")
            .select("id, amount_cents, paid_at").eq("status", "paid").eq("currency", "EUR")
            .gt("amount_cents", 0).gte("paid_at", since).order("id").range(offset, offset + batch - 1);
          if (error) throw new Error("Não foi possível consultar os pagamentos.");
          for (const row of rows ?? []) if (row.paid_at) notices.push({ id: `billing:${row.id}`, amount: row.amount_cents, paidAt: row.paid_at });
          if (!rows || rows.length < batch) break;
        }
      })(),
    ]);
    return { notices, checkedAt };
  });