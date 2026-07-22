import { createFileRoute } from "@tanstack/react-router";

/**
 * Mollie webhook — Mollie POSTs `id=tr_xxx` (as form-urlencoded) and we
 * verify by fetching the payment from the Mollie API. We never trust body
 * content. Fulfillment is idempotent via mm_studio_grant_credits (unique reason).
 */
export const Route = createFileRoute("/api/public/payments/mollie-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentType = request.headers.get("content-type") ?? "";
          let paymentId: string | null = null;
          if (contentType.includes("application/x-www-form-urlencoded")) {
            const form = await request.formData();
            paymentId = (form.get("id") as string | null) ?? null;
          } else if (contentType.includes("application/json")) {
            const body = (await request.json()) as { id?: string };
            paymentId = body?.id ?? null;
          } else {
            const text = await request.text();
            const params = new URLSearchParams(text);
            paymentId = params.get("id");
          }

          if (!paymentId || !paymentId.startsWith("tr_")) {
            console.warn("[mollie-webhook] missing id");
            return new Response("Missing id", { status: 400 });
          }

          const { getMolliePayment } = await import("@/lib/mollie.server");
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );

          const payment = await getMolliePayment(paymentId);
          const meta = (payment.metadata ?? {}) as {
            userId?: string;
            packId?: string;
            credits?: number | string;
          };

          // Update tracked status (best-effort)
          await supabaseAdmin
            .from("mm_credit_orders")
            .update({
              status: payment.status,
              raw: JSON.parse(JSON.stringify(payment)),
              updated_at: new Date().toISOString(),
            })
            .eq("provider_payment_id", paymentId);

          if (payment.status !== "paid") {
            console.log("[mollie-webhook] status", {
              id: paymentId,
              status: payment.status,
            });
            return Response.json({ received: true });
          }

          const userId = meta.userId;
          const credits = Number(meta.credits);
          if (!userId || !credits || credits <= 0) {
            console.error("[mollie-webhook] paid but bad metadata", {
              id: paymentId,
              meta,
            });
            return new Response("Bad metadata", { status: 400 });
          }

          const reason = `mollie:${paymentId}`;
          const { error } = await supabaseAdmin.rpc("mm_studio_grant_credits", {
            _user_id: userId,
            _amount: credits,
            _reason: reason,
          });
          if (error) {
            console.error("[mollie-webhook] grant failed", error);
            return new Response("Grant failed", { status: 500 });
          }

          await supabaseAdmin
            .from("mm_credit_orders")
            .update({ fulfilled_at: new Date().toISOString() })
            .eq("provider_payment_id", paymentId)
            .is("fulfilled_at", null);

          // Fire-and-forget receipt email
          try {
            const { sendEmail, emailTemplates, getUserEmailAndName } =
              await import("@/lib/email.server");
            const u = await getUserEmailAndName(userId);
            if (u) {
              const packName =
                (meta.packId && String(meta.packId)) || "Créditos";
              const tpl = emailTemplates.creditsTopup(u.name, credits, packName);
              await sendEmail({
                to: u.email,
                subject: tpl.subject,
                html: tpl.html,
                userId,
                kind: "credits_topup",
                ref: reason,
              });
            }
          } catch (e) {
            console.error("[mollie-webhook] email failed", e);
          }

          return Response.json({ received: true });
        } catch (e) {
          console.error("[mollie-webhook] error", e);
          return new Response("Webhook error", { status: 500 });
        }
      },
    },
  },
});
