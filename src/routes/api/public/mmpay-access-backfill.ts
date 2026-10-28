import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/mmpay-access-backfill")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("Authorization");
        if (!authorization?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return new Response("Unavailable", { status: 503 });
        const client = createClient(url, key, {
          auth: { persistSession: false },
          global: { headers: { Authorization: authorization } },
        });
        const { data: auth, error: authError } = await client.auth.getUser(authorization.slice(7));
        if (authError || !auth.user) return new Response("Unauthorized", { status: 401 });
        const { data: admin, error: roleError } = await client.rpc("has_role", { _user_id: auth.user.id, _role: "admin" });
        if (roleError || !admin) return new Response("Forbidden", { status: 403 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: payments, error } = await supabaseAdmin.from("mmpay_payments").select("id,stripe_session_id").eq("status", "paid");
        if (error) return new Response("Read failed", { status: 500 });
        const { grantMmpayClubAccess } = await import("@/lib/billing/mmpay.server");
        let processed = 0;
        for (const payment of payments ?? []) {
          const { data: existing, error: grantError } = await supabaseAdmin.from("entitlement_grants").select("id").eq("source", "purchase").eq("source_id", payment.id).limit(1);
          if (grantError) return new Response("Read failed", { status: 500 });
          if (existing?.length || !payment.stripe_session_id) continue;
          await grantMmpayClubAccess(payment.stripe_session_id);
          processed++;
        }
        return Response.json({ processed });
      },
    },
  },
});