import { describe, expect, it } from "vitest";
import { globalstreamSalePayload } from "./globalstream";

describe("GlobalStream sales", () => {
  it("sends the paid amount, currency and stable identifier without payment credentials", () => {
    const sale = globalstreamSalePayload({ id: "payment-1", amount_cents: 19700, currency: "eur", paid_at: "2026-10-28T23:00:00Z", email: "buyer@example.test", name: "Buyer", product_title: "MM Club", sale_type: "one_time", payment_method: "mbway" });
    expect(sale.amount).toBe(197);
    expect(sale.event_id).toBe("mmpay:payment-1");
    expect(sale.currency).toBe("EUR");
    expect(sale.sale_type).toBe("one_time");
  });
});