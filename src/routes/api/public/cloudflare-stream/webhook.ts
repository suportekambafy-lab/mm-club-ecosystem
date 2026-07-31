import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

// Cloudflare Stream webhook receiver.
// Expected header: "Webhook-Signature: time=<unix>,sig1=<hex>"
// Signature = HMAC-SHA256(secret, `${time}.${rawBody}`)

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    }),
  ) as Record<string, string>;
  const time = parts.time;
  const sig = parts.sig1;
  if (!time || !sig) return false;
  const expected = createHmac("sha256", secret).update(`${time}.${rawBody}`).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/cloudflare-stream/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CF_STREAM_WEBHOOK_SECRET;
        if (!secret) return new Response("Missing secret", { status: 500 });
        const raw = await request.text();
        const sigHeader = request.headers.get("Webhook-Signature");
        if (!verifySignature(raw, sigHeader, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Cloudflare video-ready and live status events have different shapes.
        // Video event: { uid, readyToStream, liveInput, status: {state} }
        const uid = event.uid as string | undefined;
        const liveInputId = (event.liveInput as string | undefined) ?? undefined;
        const readyToStream = event.readyToStream as boolean | undefined;
        const state = (event.status as { state?: string } | undefined)?.state;

        try {
          if (liveInputId && state === "live-inprogress") {
            const { data: rows } = await supabaseAdmin
              .from("lives")
              .update({ status: "live" })
              .eq("cf_live_input_id", liveInputId)
              .select("id");
            // Aviso automático por email (dedupe por live no email_log).
            try {
              const { sendLiveStartEmails } = await import("@/lib/live-start-email.server");
              for (const r of rows ?? []) await sendLiveStartEmails(r.id);
            } catch (e) {
              console.error("[cf-stream webhook] live start emails failed", e);
            }
          }

          if (liveInputId && (state === "live-ended" || state === "ready")) {
            if (uid && readyToStream) {
              const { data: rows } = await supabaseAdmin
                .from("lives")
                .update({ recording_video_uid: uid, status: "published" })
                .eq("cf_live_input_id", liveInputId)
                .select("id");
              // Recording finished encoding → tell members it's watchable.
              try {
                const { notifyReplayReady } = await import("@/lib/live-replay-notify.server");
                for (const r of rows ?? []) await notifyReplayReady(r.id);
              } catch (e) {
                console.error("[cf-stream webhook] replay notify failed", e);
              }
            } else {
              await supabaseAdmin
                .from("lives")
                .update({ status: "ended", ended_at: new Date().toISOString() })
                .eq("cf_live_input_id", liveInputId)
                .is("ended_at", null);
            }
          }
        } catch (e) {
          console.error("[cf-stream webhook] db update failed", e);
          return new Response("Server error", { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
