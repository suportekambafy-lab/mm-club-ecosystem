// Anúncio dos cursos "Em breve" a todos os subscritores (trial + pago).
// Corre diariamente: novos subscritores recebem automaticamente enquanto os
// cursos continuarem por lançar. Cada membro só recebe uma vez por conjunto.
import { createFileRoute } from "@tanstack/react-router";
import { courses } from "@/data/courses";
import type { Course } from "@/data/types";

const ACTIVE_STATUSES = ["trialing", "active"] as const;
const MAX_BATCH = 500;

function isUpcoming(c: Course, now: number) {
  if (c.status === "coming-soon") return true;
  if (!c.releaseAt) return false;
  const t = new Date(c.releaseAt).getTime();
  return !Number.isNaN(t) && t > now;
}

function releaseLabel(c: Course) {
  if (!c.releaseAt) return c.releaseLabel ?? "Em breve";
  const d = new Date(c.releaseAt);
  if (Number.isNaN(d.getTime())) return c.releaseLabel ?? "Em breve";
  return d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export const Route = createFileRoute("/api/public/hooks/upcoming-courses")({
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
        const upcoming = all
          .filter((c) => isUpcoming(c, now))
          .sort((a, b) =>
            String(a.releaseAt ?? "").localeCompare(String(b.releaseAt ?? "")),
          );

        if (upcoming.length === 0) {
          return Response.json({ ok: true, upcoming: 0, sent: 0 });
        }

        const { courseCoverImage } = await import("@/lib/course-cover");

        const ref = `${upcoming
          .map((c) => c.id)
          .sort()
          .join(",")}|v2`;

        const items = upcoming.map((c) => ({
          courseId: c.id,
          title: c.title,
          tagline: c.tagline,
          release: releaseLabel(c),
          cover: courseCoverImage(c),
        }));

        // ---- destinatários: trial + pago -----------------------------------
        const { data: subs, error } = await supabaseAdmin
          .from("billing_subscriptions")
          .select("user_id, status")
          .in("status", ACTIVE_STATUSES)
          .limit(MAX_BATCH);

        if (error) {
          console.error("[upcoming-courses] subs failed", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const userIds = Array.from(
          new Set((subs ?? []).map((s) => s.user_id as string)),
        );

        let sent = 0;
        let skipped = 0;
        let failed = 0;

        for (const userId of userIds) {
          const user = await getUserEmailAndName(userId);
          if (!user) {
            skipped++;
            continue;
          }
          const tpl = emailTemplates.upcomingCourses(user.name, items);
          const r = await sendEmail({
            to: user.email,
            subject: tpl.subject,
            html: tpl.html,
            userId,
            kind: "upcoming_courses",
            ref,
          });
          if (r.sent) sent++;
          else if (r.skipped) skipped++;
          else failed++;
        }

        return Response.json({
          ok: true,
          upcoming: upcoming.length,
          recipients: userIds.length,
          sent,
          skipped,
          failed,
        });
      },
    },
  },
});
