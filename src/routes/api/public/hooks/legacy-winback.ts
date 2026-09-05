// Anúncio do "Marca Milionária Legacy" para contas suspensas / em falha.
// Convite a atualizar o plano para desbloquear o curso. Um envio por membro (ref).
import { createFileRoute } from "@tanstack/react-router";
import { courses } from "@/data/courses";
import type { Course } from "@/data/types";

const COURSE_ID = "marca-milionaria-legacy";
const REF = `${COURSE_ID}|winback-v1`;
const ACTIVE_STATUSES = ["trialing", "active", "grace_period"] as const;
const LAPSED_STATUSES = [
  "suspended",
  "past_due",
  "expired",
  "cancelled",
] as const;

export const Route = createFileRoute("/api/public/hooks/legacy-winback")({
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

        const course = all.find((c) => c.id === COURSE_ID);
        if (!course) {
          return Response.json(
            { ok: false, error: "course_not_found" },
            { status: 404 },
          );
        }

        const { courseCoverImage } = await import("@/lib/course-cover");
        const payload = {
          courseId: course.id,
          title: course.title,
          cover: courseCoverImage(course),
        };

        const { data: rows, error } = await supabaseAdmin
          .from("billing_subscriptions")
          .select("user_id, status")
          .limit(5000);

        if (error) {
          return Response.json(
            { ok: false, error: error.message },
            { status: 500 },
          );
        }

        const active = new Set<string>();
        const lapsed = new Set<string>();
        for (const r of rows ?? []) {
          const userId = r.user_id as string | null;
          if (!userId) continue;
          const status = String(r.status);
          if ((ACTIVE_STATUSES as readonly string[]).includes(status))
            active.add(userId);
          else if ((LAPSED_STATUSES as readonly string[]).includes(status))
            lapsed.add(userId);
        }

        // Quem tem qualquer subscrição válida não recebe este email.
        const userIds = [...lapsed].filter((id) => !active.has(id));

        let sent = 0;
        let skipped = 0;
        let failed = 0;

        for (const userId of userIds) {
          const user = await getUserEmailAndName(userId);
          if (!user) {
            skipped++;
            continue;
          }
          const tpl = emailTemplates.legacyWinback(user.name, payload);
          const r = await sendEmail({
            to: user.email,
            subject: tpl.subject,
            html: tpl.html,
            userId,
            kind: "legacy_winback",
            ref: REF,
          }).catch(() => ({ sent: false, skipped: false }));
          if (r.sent) sent++;
          else if ((r as { skipped?: boolean }).skipped) skipped++;
          else failed++;
        }

        return Response.json({
          ok: true,
          recipients: userIds.length,
          sent,
          skipped,
          failed,
        });
      },
    },
  },
});
