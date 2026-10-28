import { describe, expect, it } from "vitest";
import { globalstreamSalePayload } from "./globalstream";

describe("GlobalStream sales", () => {
  it("sends the paid amount, currency and stable identifier without payment credentials", () => {
    const sale = globalstreamSalePayload({ id: "payment-1", amount_cents: 19700, currency: "eur", email: "buyer@example.test", name: "Buyer", product_title: "MM Club", phone: "351900000000", product_id: "product-1" });
    expect(sale.amount).toBe(197);
    expect(sale.id).toBe("payment-1");
    expect(sale.currency).toBe("EUR");
    expect(sale.status).toBe("approved");
    expect(sale.product_id).toBe("product-1");
    expect(sale.phone).toBe("351900000000");
  });
});