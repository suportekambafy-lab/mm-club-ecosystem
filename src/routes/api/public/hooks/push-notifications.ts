import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/push-notifications")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = verifyCronRequest(request);
        if (denied) return denied;

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