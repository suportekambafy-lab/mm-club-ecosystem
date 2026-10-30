import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/api/public/crm-history")({
  server: { handlers: { POST: async ({ request }) => {
    const secret = process.env["CRM_WEBHOOK_SECRET"];
    if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`) return new Response(null, { status: 401 });
    const parsed = z.object({ source: z.enum(["payment", "charge"]), offset: z.number().int().min(0).max(100000) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return new Response(null, { status: 400 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { crmConsumer } = await import("@/lib/queue/handlers/crm.server");
    const { source, offset } = parsed.data;
    let query = supabaseAdmin.from(source === "charge" ? "mmpay_subscription_charges" : "mmpay_payments").select("id,amount_cents").eq("status", "paid");
    query = source === "charge" ? query.gt("cycle_number", 1).not("finished_at", "is", null) : query.not("paid_at", "is", null);
    const { data, error } = await query.order("id").range(offset, offset + 4);
    if (error) return Response.json({ error: "Could not read sales" }, { status: 500 });
    const results = [];
    for (const sale of data ?? []) {
      try {
        await crmConsumer({ source, paymentId: sale.id });
        results.push({ id: sale.id, accepted: true, amount_cents: sale.amount_cents });
      } catch (error) {
        results.push({ id: sale.id, accepted: false, error: error instanceof Error ? error.message : "Delivery failed" });
      }
    }
    return Response.json({ results });
  } } },
});