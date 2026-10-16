import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { summarizeSales, type OwnSale } from "./sales-rules";

export const listMySales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed, error: permissionError } = await context.supabase.rpc("has_commercial_access", { _user_id: context.userId });
    if (permissionError || !allowed) throw new Error("Sem permissão para consultar vendas.");
    const sales: OwnSale[] = [];
    const batchSize = 500;
    for (let offset = 0; ; offset += batchSize) {
      const { data, error } = await context.supabase.from("leads")
        .select("id, nome, sale_amount_cents, sale_commission_brl_cents, sale_closed_at")
        .eq("sale_closed_by", context.userId).eq("status", "fechou")
        .order("sale_closed_at", { ascending: false }).order("id")
        .range(offset, offset + batchSize - 1);
      if (error) throw new Error("Não foi possível consultar as tuas vendas.");
      sales.push(...(data ?? []));
      if (!data || data.length < batchSize) break;
    }
    return { sales, totals: summarizeSales(sales) };
  });