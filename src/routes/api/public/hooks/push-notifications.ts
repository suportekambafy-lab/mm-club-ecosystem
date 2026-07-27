import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/push-notifications")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const provided =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!expected || !provided || provided !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const body = (await request.json().catch(() => ({}))) as {
          notification_id?: unknown;
        };
        const { deliverPushNotification, drainPendingPushNotifications } = await import(
          "@/lib/push.server"
        );

        if (typeof body.notification_id === "string" && body.notification_id.length > 0) {
          const result = await deliverPushNotification(body.notification_id);
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const result = await drainPendingPushNotifications(25);
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});