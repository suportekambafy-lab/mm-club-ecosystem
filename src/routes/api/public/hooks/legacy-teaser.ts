// Anúncio único do "Marca Milionária Legacy" (curso em breve, com contador).
// Envio manual/pontual: cada membro recebe apenas uma vez (idempotência por ref).
import { createFileRoute } from "@tanstack/react-router";
import { courses } from "@/data/courses";
import type { Course } from "@/data/types";

const ACTIVE_STATUSES = ["trialing", "active"] as const;
const COURSE_ID = "marca-milionaria-legacy";
const REF = `${COURSE_ID}|teaser-v1`;

function releaseLabel(c: Course) {
  if (!c.releaseAt) return c.releaseLabel ?? "Em breve";
  const d = new Date(c.releaseAt);
  if (Number.isNaN(d.getTime())) return c.releaseLabel ?? "Em breve";
  return `${d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })} · ${d.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Lisbon",
  })} (Lisboa)`;
}

export const Route = createFileRoute("/api/public/hooks/legacy-teaser")({
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
          return Response.json({ ok: false, error: "course_not_found" }, { status: 404 });
        }

        const { courseCoverImage } = await import("@/lib/course-cover");
        const payload = {
          courseId: course.id,
          title: course.title,
          release: releaseLabel(course),
          cover: courseCoverImage(course),
        };

        const { data: subs, error } = await supabaseAdmin
          .from("billing_subscriptions")
          .select("user_id, status")
          .in("status", ACTIVE_STATUSES)
          .limit(2000);

        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const userIds = Array.from(
          new Set((subs ?? []).map((s) => s.user_id as string)),
        );

        const { optedOutUserIds } = await import("@/lib/community-email.server");
        const optedOut = await optedOutUserIds("courses");

        let sent = 0;
        let skipped = 0;
        let failed = 0;

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
          const tpl = emailTemplates.legacyTeaser(user.name, payload);
          const r = await sendEmail({
            to: user.email,
            subject: tpl.subject,
            html: tpl.html,
            userId,
            kind: "legacy_teaser",
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
