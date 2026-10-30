import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/crm-delivery-check")({
  server: { handlers: { POST: async ({ request }) => {
    const secret = process.env["CRM_WEBHOOK_SECRET"];
    if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`) return new Response(null, { status: 401 });
    const { crmConsumer } = await import("@/lib/queue/handlers/crm.server");
    try {
      await crmConsumer({ source: "payment", paymentId: "334333bc-31c9-422e-b6c5-c73c50cfa074" });
      return Response.json({ accepted: true });
    } catch (error) {
      return Response.json({ accepted: false, error: error instanceof Error ? error.message : "CRM unavailable" }, { status: 502 });
    }
  } } },
});