import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function withFreshnessHeaders(request: Request, response: Response): Response {
  const url = new URL(request.url);
  const isCheckoutFlow =
    url.pathname.startsWith("/vip") ||
    url.pathname.startsWith("/checkout") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/_server");

  if (request.method !== "GET") {
    if (!isCheckoutFlow) return response;
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const accept = request.headers.get("accept") ?? "";
  const isHtmlNavigation = request.mode === "navigate" || accept.includes("text/html");
  const isFreshRuntimeAsset =
    url.pathname === "/sw.js" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css");

  if (!isHtmlNavigation && !isFreshRuntimeAsset && !isCheckoutFlow) return response;

  const headers = new Headers(response.headers);
  headers.set(
    "Cache-Control",
    isHtmlNavigation || isCheckoutFlow
      ? "no-store, max-age=0, must-revalidate"
      : "no-cache, max-age=0, must-revalidate",
  );
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  if (url.pathname === "/sw.js") headers.set("Service-Worker-Allowed", "/");
  if (isCheckoutFlow) headers.set("Clear-Site-Data", '"cache"');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return withFreshnessHeaders(request, normalized);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
