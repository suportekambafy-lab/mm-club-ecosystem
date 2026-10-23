/**
 * Webhook Viva.com. GET devolve a chave de verificação; POST recebe o aviso
 * de pagamento e reconfirma a ordem na própria Viva (o corpo nunca é confiado).
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payments/viva-webhook")({
  server: {
    handlers: {
      GET: async () => {
        const { getVivaWebhookKey } = await import("@/lib/billing/viva.server");
        try {
          return Response.json({ Key: await getVivaWebhookKey() });
        } catch (e) {
          console.error("[viva webhook key]", e);
          return new Response("error", { status: 500 });
        }
      },
      POST: async ({ request }) => {
        let orderCode: string | null = null;
        try {
          const body: any = await request.json();
          const raw = body?.EventData?.OrderCode;
          orderCode = raw != null && /^[0-9]{8,24}$/.test(String(raw)) ? String(raw) : null;
        } catch {
          return new Response("bad request", { status: 400 });
        }
        if (!orderCode) return new Response("ignored", { status: 200 });
        try {
          const { settleVivaOrder } = await import("@/lib/billing/mmpay.server");
          await settleVivaOrder(orderCode);
          return new Response("ok", { status: 200 });
        } catch (e) {
          console.error("[viva webhook]", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
