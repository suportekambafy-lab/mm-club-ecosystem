import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/globalstream-check")({
  server: { handlers: { POST: async ({ request }) => {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"], key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return new Response("Unavailable", { status: 503 });
    const client = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: authHeader } } });
    const { data } = await client.auth.getUser(authHeader.slice(7));
    if (!data.user) return new Response("Unauthorized", { status: 401 });
    const { data: admin } = await client.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
    if (!admin) return new Response("Forbidden", { status: 403 });
    const secret = process.env["GLOBALSTREAM_WEBHOOK_SECRET"];
    if (!secret) return Response.json({ configured: false });
    const res = await fetch("https://www.globalstream.live/api/public/hooks/62c76976bfa047158a21cd72ed4883bd", { method: "POST", redirect: "error", headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` }, body: "{}", signal: AbortSignal.timeout(15000) });
    return Response.json({ status: res.status });
  } } },
});