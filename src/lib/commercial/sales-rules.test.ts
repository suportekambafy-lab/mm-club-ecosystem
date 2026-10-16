import { describe, expect, it } from "vitest";
import { saleCommissionBrlCents, summarizeSales } from "./sales-rules";

describe("sales commissions", () => {
  it("grants R$150 for a 997 euro sale", () => {
    expect(saleCommissionBrlCents(99700)).toBe(15000);
  });
  it("grants R$70 for a 497 euro sale", () => {
    expect(saleCommissionBrlCents(49700)).toBe(7000);
  });
  it("does not invent a commission for other amounts", () => {
    expect(saleCommissionBrlCents(99701)).toBeNull();
    expect(saleCommissionBrlCents(49699)).toBeNull();
  });
  it("keeps EUR revenue and BRL commissions separate and counts each sale", () => {
    const sales = [99700, 49700, 25000].map((amount, i) => ({ id: String(i), nome: "Test", sale_amount_cents: amount, sale_commission_brl_cents: saleCommissionBrlCents(amount), sale_closed_at: null }));
    expect(summarizeSales(sales)).toEqual({ count: 3, revenueEurCents: 174400, commissionBrlCents: 22000, undefinedCommissionCount: 1 });
  });
});