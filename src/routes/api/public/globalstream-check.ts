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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment } = await supabaseAdmin.from("mmpay_payments").select("id").eq("status", "paid").order("paid_at", { ascending: false }).limit(1).single();
    if (!payment) return new Response("No paid sale", { status: 404 });
    const { globalstreamConsumer } = await import("@/lib/queue/handlers/globalstream.server");
    await globalstreamConsumer({ paymentId: payment.id, source: "payment" });
    return Response.json({ delivered: true });
  } } },
});