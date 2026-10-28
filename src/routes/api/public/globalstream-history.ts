import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/globalstream-history")({
  server: { handlers: { POST: async ({ request }) => {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"], key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return new Response("Unavailable", { status: 503 });
    const client = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: authorization } } });
    const { data: auth } = await client.auth.getUser(authorization.slice(7));
    if (!auth.user) return new Response("Unauthorized", { status: 401 });
    const { data: admin } = await client.rpc("has_role", { _user_id: auth.user.id, _role: "admin" });
    if (!admin) return new Response("Forbidden", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { globalstreamConsumer } = await import("@/lib/queue/handlers/globalstream.server");
    const [payments, charges] = await Promise.all([
      supabaseAdmin.from("mmpay_payments").select("id").eq("status", "paid").order("created_at"),
      supabaseAdmin.from("mmpay_subscription_charges").select("id").eq("status", "paid").gt("cycle_number", 1).order("created_at"),
    ]);
    if (payments.error || charges.error) return new Response("Read failed", { status: 500 });
    let delivered = 0, failed = 0;
    for (const job of [
      ...(payments.data ?? []).map(p => ({ paymentId: p.id, source: "payment" })),
      ...(charges.data ?? []).map(c => ({ paymentId: c.id, source: "charge" })),
    ]) {
      try { await globalstreamConsumer(job); delivered++; }
      catch { failed++; }
    }
    return Response.json({ delivered, failed, total: (payments.data?.length ?? 0) + (charges.data?.length ?? 0) });
  } } },
});