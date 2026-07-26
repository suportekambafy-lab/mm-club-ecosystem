import { afterEach, describe, expect, it, vi } from "vitest";
import { mollieGateway } from "./mollie.server";

const originalFetch = globalThis.fetch;

function mockFetch(payload: unknown, ok = true, status = 200) {
  const spy = vi.fn(async () =>
    ok
      ? new Response(JSON.stringify(payload), { status })
      : new Response("boom", { status }),
  );
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
});

describe("mollie gateway adapter", () => {
  it("reports the environment from the key prefix", () => {
    vi.stubEnv("MOLLIE_API_KEY", "test_abc");
    expect(mollieGateway.environment).toBe("test");
    vi.stubEnv("MOLLIE_API_KEY", "live_abc");
    expect(mollieGateway.environment).toBe("live");
  });

  it("fails loudly when the key is missing", () => {
    vi.stubEnv("MOLLIE_API_KEY", "");
    expect(() => mollieGateway.environment).toThrow(/MOLLIE_API_KEY/);
  });

  it("normalizes a paid payment into the domain shape", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "test_abc");
    mockFetch({
      id: "tr_1",
      status: "paid",
      amount: { value: "29.90", currency: "EUR" },
      amountRefunded: { value: "0.00" },
      method: "creditcard",
      metadata: { userId: "u1" },
      paidAt: "2026-01-01T00:00:00Z",
    });
    const p = await mollieGateway.getPayment("tr_1");
    expect(p).toMatchObject({
      id: "tr_1",
      status: "paid",
      amountCents: 2990,
      currency: "EUR",
      method: "creditcard",
      refundedCents: 0,
    });
  });

  it("maps every gateway status to a known domain status", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "test_abc");
    const cases: [string, string][] = [
      ["open", "pending"],
      ["pending", "pending"],
      ["authorized", "authorized"],
      ["paid", "paid"],
      ["failed", "failed"],
      ["expired", "expired"],
      ["canceled", "canceled"],
      ["something_new", "pending"],
    ];
    for (const [raw, expected] of cases) {
      mockFetch({ id: "tr", status: raw, amount: { value: "1.00", currency: "EUR" } });
      const p = await mollieGateway.getPayment("tr");
      expect(p.status, raw).toBe(expected);
    }
  });

  it("converts decimal amounts without floating point drift", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "test_abc");
    mockFetch({
      id: "tr",
      status: "paid",
      amount: { value: "149.90", currency: "EUR" },
      amountRefunded: { value: "9.90" },
    });
    const p = await mollieGateway.getPayment("tr");
    expect(p.amountCents).toBe(14990);
    expect(p.refundedCents).toBe(990);
  });

  it("throws with status and body when the gateway errors", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "test_abc");
    mockFetch(null, false, 404);
    await expect(mollieGateway.getPayment("tr_missing")).rejects.toThrow(/\[404\]/);
  });

  it("normalizes the webhook body to a payment reference only", async () => {
    const res = await mollieGateway.normalizeWebhook("id=tr_123", new Headers());
    expect(res).toEqual({ kind: "payment", gatewayPaymentId: "tr_123" });
  });

  it("ignores a webhook body without an id (never trusts the payload)", async () => {
    expect(await mollieGateway.normalizeWebhook("", new Headers())).toBeNull();
    expect(await mollieGateway.normalizeWebhook("foo=bar", new Headers())).toBeNull();
  });

  it("never reads the payment state from the webhook body", async () => {
    // A malicious body claiming "paid" carries no status into the domain.
    const res = await mollieGateway.normalizeWebhook("id=tr_9&status=paid", new Headers());
    expect(res).toEqual({ kind: "payment", gatewayPaymentId: "tr_9" });
    expect(JSON.stringify(res)).not.toContain("paid");
  });

  it("only returns valid mandates", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "test_abc");
    mockFetch({
      _embedded: {
        mandates: [
          { id: "mdt_1", status: "valid", method: "creditcard", details: { cardNumber: "4242" } },
          { id: "mdt_2", status: "invalid", method: "creditcard" },
        ],
      },
    });
    const mandates = await mollieGateway.listMandates("cst_1");
    expect(mandates).toHaveLength(1);
    expect(mandates[0]).toMatchObject({ id: "mdt_1", last4: "4242" });
  });
});
