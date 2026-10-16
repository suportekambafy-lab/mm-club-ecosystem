export function saleCommissionBrlCents(amountEurCents: number): number | null {
  if (amountEurCents === 99700) return 15000;
  if (amountEurCents === 49700) return 7000;
  return null;
}

export type OwnSale = {
  id: string;
  nome: string | null;
  sale_amount_cents: number | null;
  sale_commission_brl_cents: number | null;
  sale_closed_at: string | null;
};

export function summarizeSales(sales: OwnSale[]) {
  return sales.reduce((total, sale) => ({
    count: total.count + 1,
    revenueEurCents: total.revenueEurCents + (sale.sale_amount_cents ?? 0),
    commissionBrlCents: total.commissionBrlCents + (sale.sale_commission_brl_cents ?? 0),
    undefinedCommissionCount: total.undefinedCommissionCount + (sale.sale_commission_brl_cents === null ? 1 : 0),
  }), { count: 0, revenueEurCents: 0, commissionBrlCents: 0, undefinedCommissionCount: 0 });
}

export const formatCommission = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);