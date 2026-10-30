import { afterEach, describe, expect, it, vi } from "vitest";
const { loadMmpaySale } = vi.hoisted(() => ({ loadMmpaySale: vi.fn() }));
vi.mock("./mmpay-sale.server", () => ({ loadMmpaySale }));
import { crmConsumer } from "./crm.server";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("CRM sales delivery", () => {
  it("sends the same confirmed sale with its stable ID", async () => {
    vi.stubEnv("CRM_WEBHOOK_SECRET", "test-only-credential");
    loadMmpaySale.mockResolvedValue({ id: "sale-1", email: "buyer@example.test", amount: 197, currency: "EUR", status: "approved" });
    const send = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", send);
    await crmConsumer({ source: "payment", paymentId: "sale-1" });
    const call = send.mock.calls[0] as unknown as [URL, RequestInit];
    expect(call[0].origin).toBe("https://marcamilionaria.com");
    expect(call[1].redirect).toBe("manual");
    expect(call[1].headers).toMatchObject({ "Idempotency-Key": "sale-1" });
    expect(JSON.parse(String(call[1].body))).toMatchObject({ id: "sale-1", amount: 197 });
  });
  it("does not send unsettled payments or duplicate cycle one", async () => {
    vi.stubEnv("CRM_WEBHOOK_SECRET", "test-only-credential");
    loadMmpaySale.mockResolvedValue(null);
    const send = vi.fn(); vi.stubGlobal("fetch", send);
    await crmConsumer({ paymentId: "unsettled" });
    expect(send).not.toHaveBeenCalled();
  });
  it("retries redirects without forwarding credentials", async () => {
    vi.stubEnv("CRM_WEBHOOK_SECRET", "test-only-credential");
    loadMmpaySale.mockResolvedValue({ id: "sale-1" });
    const send = vi.fn(async () => new Response(null, { status: 302 }));
    vi.stubGlobal("fetch", send);
    await expect(crmConsumer({ paymentId: "sale-1" })).rejects.toThrow("HTTP 302");
    expect(send).toHaveBeenCalledOnce();
  });
  it("sanitizes transport errors before the queue logs them", async () => {
    vi.stubEnv("CRM_WEBHOOK_SECRET", "test-only-credential");
    loadMmpaySale.mockResolvedValue({ id: "sale-1" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("upstream URL details"); }));
    await expect(crmConsumer({ paymentId: "sale-1" })).rejects.toThrow(/^CRM sale delivery unavailable$/);
  });
});