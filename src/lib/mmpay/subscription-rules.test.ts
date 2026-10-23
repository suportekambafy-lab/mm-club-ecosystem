import { describe, expect, it } from "vitest";
import { addBillingInterval, afterFailedCharge, afterPaidCharge, isSubscriptionComplete } from "./subscription-rules";

describe("assinaturas MMpay", () => {
  it("duração determinada de 3 ciclos termina após a 3.ª cobrança", () => {
    expect(isSubscriptionComplete(2, 3)).toBe(false);
    expect(isSubscriptionComplete(3, 3)).toBe(true);
    const r = afterPaidCharge({ chargesDone: 3, totalCycles: 3, interval: "month", intervalCount: 1, anchor: new Date() });
    expect(r).toEqual({ status: "completed", nextChargeAt: null });
  });

  it("tempo indeterminado nunca termina", () => {
    expect(isSubscriptionComplete(500, null)).toBe(false);
  });

  it("mensal a 31 de janeiro cai no último dia de fevereiro", () => {
    expect(addBillingInterval(new Date("2026-01-31T10:00:00Z"), "month", 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
  });

  it("falha tenta de novo no dia seguinte e para ao 3.º falhanço", () => {
    const now = new Date("2026-05-01T00:00:00Z");
    expect(afterFailedCharge(1, now).nextChargeAt?.toISOString()).toBe("2026-05-02T00:00:00.000Z");
    expect(afterFailedCharge(3, now).nextChargeAt).toBeNull();
  });
});
