import { timingSafeEqual } from "crypto";

/**
 * Authentication for scheduled (pg_cron) hook endpoints.
 *
 * These routes live under /api/public/* (which bypasses site auth), so they
 * must authenticate themselves. They use a dedicated server-only secret
 * (`CRON_SECRET`) — never the publishable/anon key, which ships in the client
 * bundle and is therefore public.
 *
 * Returns a 401 Response when the caller is not authorised, or null when the
 * request may proceed.
 */
export function verifyCronRequest(request: Request): Response | null {
  const unauthorized = () =>
    new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });

  const expected = process.env.CRON_SECRET;
  if (!expected) return unauthorized();

  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (!provided) return unauthorized();

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return unauthorized();

  return null;
}
