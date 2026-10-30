import { afterEach, describe, expect, it, vi } from "vitest";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from },
}));
import { globalstreamConsumer } from "./globalstream.server";

function paidSale() {
  from.mockImplementation((table: string) => ({
    select: () => ({ eq: () => ({
      single: async () => ({ data: {
        id: "sale-29-oct", link_id: "product-1", status: "paid",
        paid_at: "2026-10-29T22:00:38Z", amount_cents: 19700,
        currency: "EUR", email: "buyer@example.test", name: "Buyer", phone: null,
      }, error: null }),
      maybeSingle: async () => ({ data: table === "mmpay_links" ? { title: "MM Club" } : null, error: null }),
    }) }),
  }));
  vi.stubEnv("GLOBALSTREAM_WEBHOOK_SECRET", "test-secret");
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("GlobalStream delivery", () => {
  it("sends a settled sale with a Worker-compatible no-forwarding redirect policy", async () => {
    paidSale();
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      if (init.redirect === "error") throw new Error("Invalid redirect value");
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await globalstreamConsumer({ source: "payment", paymentId: "sale-29-oct" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.redirect).toBe("manual");
    expect(init?.headers).toMatchObject({ "Idempotency-Key": "sale-29-oct" });
    expect(JSON.parse(String(init?.body))).toMatchObject({ id: "sale-29-oct", amount: 197, status: "approved" });
  });

  it("does not acknowledge a redirect as a delivered sale", async () => {
    paidSale();
    const fetchMock = vi.fn(async () => new Response(null, { status: 302, headers: { Location: "https://example.test" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(globalstreamConsumer({ source: "payment", paymentId: "sale-29-oct" })).rejects.toThrow("HTTP 302");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});