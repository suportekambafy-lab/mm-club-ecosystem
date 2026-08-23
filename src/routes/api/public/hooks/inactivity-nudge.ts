// Anti-churn — membros sem entrar há 14+ dias recebem email + push.
// Chamado por pg_cron (diário). Requer o CRON_SECRET no header `x-cron-secret`.
import { createFileRoute } from "@tanstack/react-router";
import { courses } from "@/data/courses";

const INACTIVE_DAYS = 14;
const MAX_BATCH = 200;

function lessonTitles(courseId: string, lessonId: string) {
  const course = courses.find((c) => c.id === courseId);
  if (!course) return null;
  for (const m of course.modules ?? []) {
    const l = m.lessons.find((x) => x.id === lessonId);
    if (l) return { courseTitle: course.title, lessonTitle: l.title };
  }
  return null;
}

export const Route = createFileRoute("/api/public/hooks/inactivity-nudge")({
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

        const cutoff = new Date(Date.now() - INACTIVE_DAYS * 86_400_000).toISOString();

        // Só quem já entrou alguma vez (last_seen_at preenchido) e está ausente.
        const { data: rows, error } = await supabaseAdmin
          .from("profiles")
          .select("id, last_seen_at")
          .not("last_seen_at", "is", null)
          .lt("last_seen_at", cutoff)
          .limit(MAX_BATCH);

        if (error) {
          console.error("[inactivity] fetch profiles failed", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        // Idempotência: um nudge por membro por semana ISO.
        const now = new Date();
        const weekRef = `${now.getUTCFullYear()}-W${String(
          Math.ceil(
            ((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7,
          ),
        ).padStart(2, "0")}`;

        let sent = 0;
        let skipped = 0;
        let failed = 0;

        for (const row of (rows ?? []) as { id: string; last_seen_at: string }[]) {
          const userId = row.id;

          // Só membros com acesso activo — não incomodamos quem já saiu.
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

          const days = Math.max(
            INACTIVE_DAYS,
            Math.floor((Date.now() - new Date(row.last_seen_at).getTime()) / 86_400_000),
          );

          // Última aula em progresso, para o email ser específico.
          const { data: prog } = await supabaseAdmin
            .from("lesson_progress")
            .select("course_id, lesson_id, last_watched_at")
            .eq("user_id", userId)
            .order("last_watched_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const p = prog as { course_id: string; lesson_id: string } | null;
          const titles = p ? lessonTitles(p.course_id, p.lesson_id) : null;

          // 21+ dias sem entrar → mensagem forte ("lembras-te do que te fez entrar?").
          const strong = days >= 21;
          const args = {
            name: user.name,
            days,
            courseTitle: titles?.courseTitle ?? null,
            lessonTitle: titles?.lessonTitle ?? null,
            courseId: titles ? p!.course_id : null,
            lessonId: titles ? p!.lesson_id : null,
          };
          const tpl = strong
            ? emailTemplates.wakeUpCall(args)
            : emailTemplates.inactivityNudge(args);

          const result = await sendEmail({
            to: user.email,
            subject: tpl.subject,
            html: tpl.html,
            userId,
            kind: strong ? "wakeup_call" : "inactivity_nudge",
            ref: weekRef,
          });


          if (result.sent) sent++;
          else if (result.skipped) {
            skipped++;
            continue;
          } else {
            failed++;
            continue;
          }

          // Sino no dashboard — o trigger de push entrega no PWA.
          await supabaseAdmin
            .from("notifications")
            .insert({ user_id: userId, kind: "inactivity" });
        }

        return Response.json({ ok: true, sent, skipped, failed });
      },
    },
  },
});
