import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CommercialTransaction = { id: string; source: "MMpay" | "Prestação MMpay" | "Assinatura"; amountCents: number; currency: string; status: string; date: string; buyer: string | null; email: string | null; method: string | null; product: string | null };

export const listCommercialTransactions = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: allowed, error } = await context.supabase.rpc("has_commercial_access", { _user_id: context.userId });
  if (error || !allowed) throw new Error("Sem permissão.");
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [mm, charges, billing] = await Promise.all([
    db.from("mmpay_payments").select("id, amount_cents, currency, status, created_at, paid_at, name, email, payment_method, mmpay_links(title)").order("created_at", { ascending: false }).limit(1000),
    db.from("mmpay_subscription_charges").select("id, amount_cents, status, created_at, finished_at, cycle_number, mmpay_subscriptions(customer_name, customer_email, product_title)").gt("cycle_number", 1).order("created_at", { ascending: false }).limit(1000),
    db.from("billing_payments").select("id, amount_cents, currency, status, created_at, paid_at, method, gateway, user_id").order("created_at", { ascending: false }).limit(1000),
  ]);
  if (mm.error || charges.error || billing.error) throw new Error("Não foi possível carregar as transações.");
  const userIds = [...new Set((billing.data ?? []).map(b => b.user_id))];
  const { data: profiles } = userIds.length ? await db.from("profiles").select("id, display_name").in("id", userIds) : { data: [] };
  const { data: customers } = userIds.length ? await db.from("billing_customers").select("user_id, email").in("user_id", userIds) : { data: [] };
  const rows: CommercialTransaction[] = [
    ...(mm.data ?? []).map((r: any) => ({ id: `mmpay:${r.id}`, source: "MMpay" as const, amountCents: r.amount_cents, currency: r.currency, status: r.status, date: r.paid_at ?? r.created_at, buyer: r.name, email: r.email, method: r.payment_method, product: r.mmpay_links?.title ?? null })),
    ...(charges.data ?? []).map((r: any) => ({ id: `charge:${r.id}`, source: "Prestação MMpay" as const, amountCents: r.amount_cents, currency: "EUR", status: r.status, date: r.finished_at ?? r.created_at, buyer: r.mmpay_subscriptions?.customer_name ?? null, email: r.mmpay_subscriptions?.customer_email ?? null, method: null, product: `${r.mmpay_subscriptions?.product_title ?? "Assinatura"} · prestação ${r.cycle_number}` })),
    ...(billing.data ?? []).map(r => ({ id: `billing:${r.id}`, source: "Assinatura" as const, amountCents: r.amount_cents, currency: r.currency, status: String(r.status), date: r.paid_at ?? r.created_at, buyer: profiles?.find(p => p.id === r.user_id)?.display_name ?? null, email: customers?.find(c => c.user_id === r.user_id)?.email ?? null, method: r.method ?? r.gateway, product: null })),
  ];
  return rows.sort((a, b) => b.date.localeCompare(a.date));
});
