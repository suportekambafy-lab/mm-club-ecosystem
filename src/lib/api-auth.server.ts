import { createClient } from "@supabase/supabase-js";

/**
 * Auth helpers for raw HTTP routes under src/routes/api/*.
 *
 * These routes are reachable without the app shell, so any route that spends
 * money (AI gateway) or sends branded email must verify the caller's Supabase
 * session itself.
 */
export type RequestUser = { id: string; email: string | null };

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export async function getRequestUser(request: Request): Promise<RequestUser | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")?.trim();
  if (!token) return null;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  const client = createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/** Returns the user, or a 401 Response when the request has no valid session. */
export async function requireRequestUser(
  request: Request,
): Promise<{ user: RequestUser } | { denied: Response }> {
  const user = await getRequestUser(request);
  if (!user) return { denied: unauthorizedResponse() };
  return { user };
}

/** Returns the admin user, or a 401/403 Response. */
export async function requireRequestAdmin(
  request: Request,
): Promise<{ user: RequestUser } | { denied: Response }> {
  const user = await getRequestUser(request);
  if (!user) return { denied: unauthorizedResponse() };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (error || data !== true) {
    return {
      denied: new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }
  return { user };
}
