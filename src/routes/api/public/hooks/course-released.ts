// Lançamento de cursos agendados.
// Corre a cada 5 minutos: detecta cursos cuja data de lançamento (`releaseAt`)
// já passou e anuncia-os uma única vez — email + notificação no sino (que por
// sua vez dispara o push do PWA).
import { createFileRoute } from "@tanstack/react-router";
import { courses } from "@/data/courses";
import type { Course } from "@/data/types";

const ACTIVE_STATUSES = ["trialing", "active"] as const;
const MAX_BATCH = 1000;
/** Janela de recuperação: lançamentos das últimas 48h ainda são anunciados. */
const LOOKBACK_MS = 48 * 60 * 60 * 1000;

function justReleased(c: Course, now: number) {
  if (c.status === "coming-soon") return false;
  if (!c.releaseAt) return false;
  const t = new Date(c.releaseAt).getTime();
  if (Number.isNaN(t)) return false;
  return t <= now && now - t <= LOOKBACK_MS;
}

export const Route = createFileRoute("/api/public/hooks/course-released")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = verifyCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { sendEmail, emailTemplates, getUserEmailAndName } = await import(
          "@/lib/email.server"
        );

        // ---- catálogo actual (estático + criados/editados no admin) --------
        const { data: overrideRow } = await supabaseAdmin
          .from("admin_overrides")
          .select("data")
          .eq("id", "courses")
          .maybeSingle();

        const ov = (overrideRow?.data ?? {}) as {
          courses?: Record<string, Partial<Course>>;
          newCourses?: Course[];
        };

        const all: Course[] = [...courses, ...(ov.newCourses ?? [])].map((c) => ({
          ...c,
          ...(ov.courses?.[c.id] ?? {}),
        }));

        const now = Date.now();
        const released = all.filter((c) => justReleased(c, now));

        if (released.length === 0) {
          return Response.json({ ok: true, released: 0, sent: 0 });
        }

        const { courseCoverImage } = await import("@/lib/course-cover");

        // ---- destinatários: trial + pago -----------------------------------
        const { data: subs, error } = await supabaseAdmin
          .from("billing_subscriptions")
          .select("user_id, status")
          .in("status", ACTIVE_STATUSES)
          .limit(MAX_BATCH);

        if (error) {
          console.error("[course-released] subs failed", error);
          return Response.json(
            { ok: false, error: error.message },
            { status: 500 },
          );
        }

        const userIds = Array.from(
          new Set(
            (subs ?? [])
              .map((s) => s.user_id as string | null)
              .filter((v): v is string => !!v),
          ),
        );

        const { optedOutUserIds } = await import("@/lib/community-email.server");
        const optedOut = await optedOutUserIds("courses");

        let sent = 0;
        let skipped = 0;
        let failed = 0;
        let notified = 0;

        for (const course of released) {
          // Sino + push: uma notificação por membro e por curso (índice único).
          const rows = userIds.map((userId) => ({
            user_id: userId,
            kind: "course_released" as const,
            course_id: course.id,
          }));
          for (let i = 0; i < rows.length; i += 200) {
            const chunk = rows.slice(i, i + 200);
            const { error: notifErr, count } = await supabaseAdmin
              .from("notifications")
              .upsert(chunk, {
                onConflict: "user_id,course_id",
                ignoreDuplicates: true,
                count: "exact",
              });
            if (notifErr) console.error("[course-released] notif", notifErr);
            else notified += count ?? 0;
          }

          const tplData = {
            courseId: course.id,
            title: course.title,
            tagline: course.tagline,
            cover: courseCoverImage(course),
          };

          for (const userId of userIds) {
            if (optedOut.has(userId)) {
              skipped++;
              continue;
            }
            const user = await getUserEmailAndName(userId);
            if (!user) {
              skipped++;
              continue;
            }
            const tpl = emailTemplates.courseReleased(user.name, tplData);
            const r = await sendEmail({
              to: user.email,
              subject: tpl.subject,
              html: tpl.html,
              userId,
              kind: "course_released",
              ref: course.id,
            });
            if (r.sent) sent++;
            else if (r.skipped) skipped++;
            else failed++;
          }
        }

        return Response.json({
          ok: true,
          released: released.length,
          courses: released.map((c) => c.id),
          recipients: userIds.length,
          notified,
          sent,
          skipped,
          failed,
        });
      },
    },
  },
});
