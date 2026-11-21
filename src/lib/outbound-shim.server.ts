/**
 * Outbound fetch shim for running MM Club outside Lovable (e.g. on Vercel).
 *
 * Inactive unless OFF_LOVABLE=1, so the Lovable deployment is unaffected.
 *
 * OFF_LOVABLE=1
 *   Rewrites calls to Lovable-only gateways to the providers' own APIs:
 *   - ai.gateway.lovable.dev/v1/*            -> AI_GATEWAY_BASE_URL/* (Bearer AI_GATEWAY_API_KEY),
 *     or, with AI_PROVIDER=openai (default when only OPENAI_API_KEY is set), straight to
 *     OpenAI, and to Gemini for /v1/videos (see ai-direct.server.ts)
 *   - connector-gateway.lovable.dev/resend/* -> api.resend.com/*      (Bearer X-Connection-Api-Key)
 *   - connector-gateway.lovable.dev/paddle/* -> (sandbox-)api.paddle.com/*
 *   - connector-gateway.lovable.dev/firecrawl/* -> api.firecrawl.dev/*
 *   The code still checks that LOVABLE_API_KEY is set; any placeholder works, it is never sent.
 *
 * SAFE_MODE=1 (test deployments)
 *   Only allowlisted hosts are reachable. Emails and web push are swallowed with a fake
 *   success, Stripe/Mollie need test keys, Viva must be the demo environment, and
 *   everything else (old app, CRM, Meta CAPI, partner webhooks...) is blocked with a 503.
 *   Extra hosts: SAFE_MODE_ALLOW_HOSTS="host1,host2".
 */

import { directAiEnabled, handleDirectAi } from "./ai-direct.server";

const LOVABLE_AI = "ai.gateway.lovable.dev";
const LOVABLE_CONNECTORS = "connector-gateway.lovable.dev";

const PUSH_HOST_SUFFIXES = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "notify.windows.com",
  "push.apple.com",
];

const SAFE_BASE_ALLOW = [
  "api.cloudflare.com",
  "videodelivery.net",
  "cloudflarestream.com",
  "demo.vivapayments.com",
  "demo-api.vivapayments.com",
  "demo-accounts.vivapayments.com",
  "sandbox-api.paddle.com",
  "api.firecrawl.dev",
  "r.jina.ai",
  // AI providers: they never message students or move money.
  "api.openai.com",
  "generativelanguage.googleapis.com",
];

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function hostOf(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).host;
  } catch {
    return undefined;
  }
}

function matchesHost(host: string, entry: string): boolean {
  return host === entry || host.endsWith(`.${entry}`);
}

function safeAllowList(): string[] {
  const extra = (env("SAFE_MODE_ALLOW_HOSTS") ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  const dynamic = [
    hostOf(env("SUPABASE_URL")),
    hostOf(env("VITE_SUPABASE_URL")),
    hostOf(env("AI_GATEWAY_BASE_URL")),
    hostOf(env("LIVEKIT_URL")?.replace(/^wss?:/, "https:")),
    hostOf(env("LIVEKIT_EGRESS_S3_ENDPOINT")),
    hostOf(env("PUBLIC_APP_URL")),
  ].filter((h): h is string => !!h);
  return [...SAFE_BASE_ALLOW, ...dynamic, ...extra];
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function authToken(headers: Headers): string {
  return (headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
}

type Rewritten = { url: string; headers: Headers };

function rewriteLovable(url: URL, headers: Headers): Rewritten | null {
  if (url.host === LOVABLE_AI) {
    const base = (env("AI_GATEWAY_BASE_URL") ?? "https://ai-gateway.vercel.sh/v1").replace(/\/+$/, "");
    const key = env("AI_GATEWAY_API_KEY");
    if (!key) throw new Error("AI_GATEWAY_API_KEY is not configured");
    const rest = url.pathname.replace(/^\/v1/, "");
    headers.delete("lovable-api-key");
    headers.delete("x-lovable-aig-sdk");
    headers.set("authorization", `Bearer ${key}`);
    return { url: `${base}${rest}${url.search}`, headers };
  }

  if (url.host === LOVABLE_CONNECTORS) {
    const [, connector, ...rest] = url.pathname.split("/");
    const path = `/${rest.join("/")}${url.search}`;
    const key = headers.get("x-connection-api-key") ?? "";
    headers.delete("x-connection-api-key");
    headers.delete("lovable-api-key");
    headers.set("authorization", `Bearer ${key}`);
    if (connector === "resend") return { url: `https://api.resend.com${path}`, headers };
    if (connector === "firecrawl") return { url: `https://api.firecrawl.dev${path}`, headers };
    if (connector === "paddle") {
      const sandbox = key.includes("_sdbx");
      return { url: `https://${sandbox ? "sandbox-api" : "api"}.paddle.com${path}`, headers };
    }
    throw new Error(`Lovable connector "${connector}" has no off-Lovable mapping`);
  }

  return null;
}

function safeModeVerdict(url: URL, headers: Headers): Response | null {
  const host = url.host;

  if (host === "api.resend.com") {
    console.warn("[safe-mode] email not sent:", url.pathname);
    return json(200, { id: `safe-mode-${crypto.randomUUID()}` });
  }
  if (PUSH_HOST_SUFFIXES.some((s) => matchesHost(host, s))) {
    console.warn("[safe-mode] web push not sent");
    return new Response(null, { status: 201 });
  }
  if (host === "api.stripe.com") {
    return authToken(headers).startsWith("sk_test_") ? null : json(503, { blocked: "stripe live key" });
  }
  if (host === "api.mollie.com") {
    return authToken(headers).startsWith("test_") ? null : json(503, { blocked: "mollie live key" });
  }
  if (safeAllowList().some((entry) => matchesHost(host, entry))) return null;

  console.warn("[safe-mode] blocked outbound request to", host);
  return json(503, { blocked: host });
}

let installed = false;

export function installOutboundShim(): void {
  if (installed || env("OFF_LOVABLE") !== "1") return;
  installed = true;
  const safeMode = env("SAFE_MODE") === "1";
  const original = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    let url = new URL(request.url);
    let headers = new Headers(request.headers);

    // AI straight from OpenAI/Gemini instead of a gateway (AI_PROVIDER=openai, or no gateway key).
    if (url.host === LOVABLE_AI && directAiEnabled()) return handleDirectAi(original, request, url);

    const rewritten = rewriteLovable(url, headers);
    if (rewritten) {
      url = new URL(rewritten.url);
      headers = rewritten.headers;
    }

    if (safeMode) {
      const verdict = safeModeVerdict(url, headers);
      if (verdict) return verdict;
    }

    if (!rewritten) return original(request);
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
    return original(url.toString(), {
      method: request.method,
      headers,
      body,
      redirect: request.redirect,
      signal: request.signal,
    });
  }) as typeof fetch;

  console.info(`[outbound-shim] active (safe mode ${safeMode ? "on" : "off"})`);
}
