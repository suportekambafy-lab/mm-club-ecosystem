/**
 * Teste dos emails de retenção (ofensiva + chamada de atenção).
 * POST /api/public/hooks/retention-test-email?mode=streak|wakeup|both&to=...
 * Auth: Authorization: Bearer <CRON_SECRET> (ou header x-cron-secret).
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/retention-test-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = verifyCronRequest(request);
        if (denied) return denied;

        const url = new URL(request.url);
        const to = url.searchParams.get("to") ?? "victormuabi20@gmail.com";
        const mode = url.searchParams.get("mode") ?? "both";
        const name = url.searchParams.get("name") ?? "Victor";

        const { sendEmail, emailTemplates } = await import("@/lib/email.server");
        const { courses } = await import("@/data/courses");

        const course = courses[0];
        const lesson = course?.modules?.[0]?.lessons?.[0] ?? null;
        const ctx = {
          name,
          courseTitle: course?.title ?? null,
          lessonTitle: lesson?.title ?? null,
          courseId: course?.id ?? null,
          lessonId: lesson?.id ?? null,
        };

        const out: Record<string, unknown> = {};
        const stamp = Date.now();

        if (mode === "streak" || mode === "both") {
          const tpl = emailTemplates.streakGuard({ ...ctx, streak: 4, longest: 6 });
          out.streak = await sendEmail({
            to,
            subject: tpl.subject,
            html: tpl.html,
            kind: "streak_guard",
            ref: `test-${stamp}`,
          });
        }
        if (mode === "wakeup" || mode === "both") {
          const tpl = emailTemplates.wakeUpCall({ ...ctx, days: 23 });
          out.wakeup = await sendEmail({
            to,
            subject: tpl.subject,
            html: tpl.html,
            kind: "wakeup_call",
            ref: `test-${stamp}`,
          });
        }

        return Response.json({ ok: true, to, ...out });
      },
    },
  },
});
