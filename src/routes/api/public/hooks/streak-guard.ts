// Guardião da ofensiva — email a quem tem sequência viva e ainda não estudou hoje.
// Chamado por pg_cron (ex.: 18:00 Lisboa). Requer CRON_SECRET no header `x-cron-secret`.
import { createFileRoute } from "@tanstack/react-router";
import { courses } from "@/data/courses";

const MAX_BATCH = 300;

function lessonTitles(courseId: string, lessonId: string) {
  const course = courses.find((c) => c.id === courseId);
  if (!course) return null;
  for (const m of course.modules ?? []) {
    const l = m.lessons.find((x) => x.id === lessonId);
    if (l) return { courseTitle: course.title, lessonTitle: l.title };
  }
  return null;
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Sequência de dias consecutivos até `ref` (inclusive), a partir de dias ordenados desc. */
function streakUntil(days: string[], ref: string): number {
  const set = new Set(days);
  let count = 0;
  const cursor = new Date(`${ref}T00:00:00Z`);
  while (set.has(dayKey(cursor))) {
    count++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return count;
}

export const Route = createFileRoute("/api/public/hooks/streak-guard")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = verifyCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendEmail, emailTemplates, getUserEmailAndName } = await import(
          "@/lib/email.server"
        );

        const today = dayKey(new Date());
        const yesterday = dayKey(new Date(Date.now() - 86_400_000));
        const since = dayKey(new Date(Date.now() - 45 * 86_400_000));

        const { data: rows, error } = await supabaseAdmin
          .from("learning_activity")
          .select("user_id, day, minutes")
          .gte("day", since)
          .gt("minutes", 0);

        if (error) {
          console.error("[streak-guard] fetch failed", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const byUser = new Map<string, string[]>();
        for (const r of (rows ?? []) as { user_id: string; day: string }[]) {
          const list = byUser.get(r.user_id) ?? [];
          list.push(r.day);
          byUser.set(r.user_id, list);
        }

        let sent = 0;
        let skipped = 0;
        let failed = 0;
        let processed = 0;

        for (const [userId, days] of byUser) {
          if (processed >= MAX_BATCH) break;

          // Já estudou hoje → nada a proteger.
          if (days.includes(today)) {
            skipped++;
            continue;
          }
          const streak = streakUntil(days, yesterday);
          if (streak < 2) {
            skipped++;
            continue;
          }
          processed++;

          const { data: hasAccess } = await supabaseAdmin.rpc("has_feature", {
            _user_id: userId,
            _feature: "academy.access",
          });
          if (!hasAccess) {
            skipped++;
            continue;
          }

          const user = await getUserEmailAndName(userId);
          if (!user) {
            skipped++;
            continue;
          }

          // Recorde histórico (melhor sequência dentro da janela lida).
          const sorted = [...new Set(days)].sort();
          let longest = 0;
          let run = 0;
          let prev: string | null = null;
          for (const d of sorted) {
            if (prev) {
              const gap =
                (new Date(`${d}T00:00:00Z`).getTime() -
                  new Date(`${prev}T00:00:00Z`).getTime()) /
                86_400_000;
              run = gap === 1 ? run + 1 : 1;
            } else {
              run = 1;
            }
            if (run > longest) longest = run;
            prev = d;
          }

          const { data: prog } = await supabaseAdmin
            .from("lesson_progress")
            .select("course_id, lesson_id, last_watched_at")
            .eq("user_id", userId)
            .order("last_watched_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const p = prog as { course_id: string; lesson_id: string } | null;
          const titles = p ? lessonTitles(p.course_id, p.lesson_id) : null;

          const tpl = emailTemplates.streakGuard({
            name: user.name,
            streak,
            longest: Math.max(longest, streak),
            courseTitle: titles?.courseTitle ?? null,
            lessonTitle: titles?.lessonTitle ?? null,
            courseId: titles ? p!.course_id : null,
            lessonId: titles ? p!.lesson_id : null,
          });

          const result = await sendEmail({
            to: user.email,
            subject: tpl.subject,
            html: tpl.html,
            userId,
            kind: "streak_guard",
            ref: today,
          });

          if (result.sent) sent++;
          else if (result.skipped) skipped++;
          else failed++;
        }

        return Response.json({ ok: true, sent, skipped, failed });
      },
    },
  },
});
