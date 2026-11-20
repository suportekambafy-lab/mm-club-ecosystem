import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Call = { url: string; headers: Headers };

async function load(envs: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(envs)) vi.stubEnv(k, v);
  const calls: Call[] = [];
  const fake = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    calls.push({ url: req.url, headers: new Headers(req.headers) });
    return new Response("{}", { status: 200 });
  });
  globalThis.fetch = fake as unknown as typeof fetch;
  const mod = await import("./outbound-shim.server");
  mod.installOutboundShim();
  return calls;
}

const realFetch = globalThis.fetch;

describe("outbound shim", () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.unstubAllEnvs();
  });

  it("does nothing unless OFF_LOVABLE=1", async () => {
    const calls = await load({ OFF_LOVABLE: "" });
    await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST" });
    expect(calls[0].url).toBe("https://ai.gateway.lovable.dev/v1/chat/completions");
  });

  it("rewrites the AI gateway with the new key", async () => {
    const calls = await load({ OFF_LOVABLE: "1", AI_GATEWAY_API_KEY: "k1", AI_GATEWAY_BASE_URL: "https://ai.example.com/v1" });
    await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer lovable", "Lovable-API-Key": "lovable" },
      body: "{}",
    });
    expect(calls[0].url).toBe("https://ai.example.com/v1/chat/completions");
    expect(calls[0].headers.get("authorization")).toBe("Bearer k1");
    expect(calls[0].headers.get("lovable-api-key")).toBeNull();
  });

  it("rewrites Resend and Paddle connectors to the providers", async () => {
    const calls = await load({ OFF_LOVABLE: "1" });
    await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: { Authorization: "Bearer lovable", "X-Connection-Api-Key": "re_123" },
      body: "{}",
    });
    await fetch("https://connector-gateway.lovable.dev/paddle/transactions/1", {
      headers: { "X-Connection-Api-Key": "pdl_sdbx_apikey_1" },
    });
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(calls[0].headers.get("authorization")).toBe("Bearer re_123");
    expect(calls[0].headers.get("x-connection-api-key")).toBeNull();
    expect(calls[1].url).toBe("https://sandbox-api.paddle.com/transactions/1");
  });

  it("in safe mode swallows emails and blocks unknown hosts and live keys", async () => {
    const calls = await load({ OFF_LOVABLE: "1", SAFE_MODE: "1", SUPABASE_URL: "https://abc.supabase.co" });
    const email = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: { "X-Connection-Api-Key": "re_123" },
      body: "{}",
    });
    expect(email.status).toBe(200);
    expect((await fetch("https://project--x.lovable.app/api/public/hooks/billing-tick")).status).toBe(503);
    expect((await fetch("https://www.vivapayments.com/api/orders")).status).toBe(503);
    expect(
      (await fetch("https://api.stripe.com/v1/charges", { headers: { Authorization: "Bearer sk_live_1" } })).status,
    ).toBe(503);
    await fetch("https://api.stripe.com/v1/charges", { headers: { Authorization: "Bearer sk_test_1" } });
    await fetch("https://abc.supabase.co/rest/v1/profiles");
    expect(calls.map((c) => new URL(c.url).host)).toEqual(["api.stripe.com", "abc.supabase.co"]);
  });
});
