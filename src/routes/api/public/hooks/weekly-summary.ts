// Weekly AI-generated lesson summary email.
// Called by pg_cron every Monday. Requires apikey header (Supabase anon key)
// as documented for /api/public/* cron endpoints.
import { createFileRoute } from "@tanstack/react-router";
import { courses } from "@/data/courses";

type LessonRef = {
  courseId: string;
  lessonId: string;
  courseTitle: string;
  lessonTitle: string;
};

function findLesson(courseId: string, lessonId: string): LessonRef | null {
  const course = courses.find((c) => c.id === courseId);
  if (!course) return null;
  for (const m of course.modules ?? []) {
    const l = m.lessons.find((x) => x.id === lessonId);
    if (l)
      return {
        courseId,
        lessonId,
        courseTitle: course.title,
        lessonTitle: l.title,
      };
  }
  return null;
}

async function generateSummary(
  courseTitle: string,
  lessonTitle: string,
  transcript: string,
): Promise<string> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) return fallbackSummary(lessonTitle);

  const trimmed = transcript.slice(0, 12000);
  const prompt = `Estás a escrever um email semanal PT-PT (formal-próximo, tom premium) para um aluno do MM Club sobre a aula "${lessonTitle}" do curso "${courseTitle}".

Baseando-te apenas na transcrição abaixo, escreve um resumo EXPLICATIVO em HTML puro (sem markdown, sem <html>, apenas <p>, <strong>, <em>, <ul>, <li>):
- Começa com 1 parágrafo curto (2 frases) com a ideia central.
- Segue com uma <ul> de 3 a 5 pontos-chave concretos que o aluno aprendeu.
- Termina com 1 parágrafo curto ligando a aula à ação prática da semana.
- Sem introduções tipo "Nesta aula...". Direto ao valor.
- Máximo 180 palavras.

Transcrição:
"""${trimmed}"""`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": lovableKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Escreves resumos didáticos em PT-PT, tom premium, sem clichés." },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
      }),
    });
    if (!res.ok) return fallbackSummary(lessonTitle);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return fallbackSummary(lessonTitle);
    return text.replace(/```html|```/g, "").trim();
  } catch (e) {
    console.error("[weekly] AI summary failed", e);
    return fallbackSummary(lessonTitle);
  }
}

function fallbackSummary(lessonTitle: string): string {
  return `<p>Esta semana estás em <strong>${lessonTitle}</strong>. Retoma a aula e aplica pelo menos <strong>uma</strong> ideia no teu projeto — o método MM só funciona quando executas.</p>`;
}

export const Route = createFileRoute("/api/public/hooks/weekly-summary")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Lightweight auth: require Supabase anon key in apikey header
        const anon = request.headers.get("apikey");
        if (!anon || anon !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { sendEmail, emailTemplates, getUserEmailAndName } = await import(
          "@/lib/email.server"
        );

        // Get all lesson_progress rows in the last 30 days, most recent per user
        const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
        const { data: rows, error } = await supabaseAdmin
          .from("lesson_progress")
          .select("user_id, course_id, lesson_id, last_watched_at, completed")
          .gte("last_watched_at", since)
          .order("last_watched_at", { ascending: false });

        if (error) {
          console.error("[weekly] fetch progress failed", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        // Pick last watched (in-progress if possible, else last) per user
        const byUser = new Map<string, typeof rows[number]>();
        for (const r of rows ?? []) {
          if (!byUser.has(r.user_id)) byUser.set(r.user_id, r);
        }

        const weekRef = new Date().toISOString().slice(0, 10); // YYYY-MM-DD idempotency
        let sent = 0;
        let skipped = 0;
        let failed = 0;

        for (const [userId, prog] of byUser) {
          const lesson = findLesson(prog.course_id, prog.lesson_id);
          if (!lesson) {
            skipped++;
            continue;
          }
          const user = await getUserEmailAndName(userId);
          if (!user) {
            skipped++;
            continue;
          }

          // Fetch transcript for that lesson
          const { data: transcript } = await supabaseAdmin
            .from("lesson_transcripts")
            .select("transcript, lesson_title, course_title, status")
            .eq("course_id", lesson.courseId)
            .eq("lesson_id", lesson.lessonId)
            .maybeSingle();

          const transcriptText =
            (transcript as { transcript?: string | null } | null)?.transcript ??
            "";

          const summary = transcriptText
            ? await generateSummary(
                lesson.courseTitle,
                lesson.lessonTitle,
                transcriptText,
              )
            : fallbackSummary(lesson.lessonTitle);

          const tpl = emailTemplates.weeklySummary(
            user.name,
            lesson.courseTitle,
            lesson.lessonTitle,
            summary,
            lesson.courseId,
            lesson.lessonId,
          );

          const result = await sendEmail({
            to: user.email,
            subject: tpl.subject,
            html: tpl.html,
            userId,
            kind: "weekly_summary",
            ref: weekRef,
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
