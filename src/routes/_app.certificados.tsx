import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, Download, Loader2, Play, Share2 } from "lucide-react";
import { courses as allCourses } from "@/data/courses";
import { useCourseAccess } from "@/hooks/use-course-release";
import { useUserProgress } from "@/hooks/use-user-progress";
import { computeCourseDuration, computeLessonsCount, parseDurationToMinutes } from "@/lib/course-duration";
import { supabase } from "@/integrations/supabase/client";
import { getCertificatePdf } from "@/lib/certificates.functions";
import { sendCertificateEmail } from "@/lib/certificate-email.functions";
import { Skeleton } from "@/components/ui/skeleton";
import type { Course } from "@/data/types";

export const Route = createFileRoute("/_app/certificados")({
  head: () => ({
    meta: [
      { title: "Certificados — MM Club" },
      {
        name: "description",
        content:
          "Acompanha os teus certificados MM Club: vê quais já estão prontos e quantas aulas faltam para concluir cada curso.",
      },
      { property: "og:title", content: "Certificados — MM Club" },
      {
        property: "og:description",
        content: "Vê os teus certificados MM Club e quantas aulas faltam para concluir cada curso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CertificadosPage,
});

type CertRow = { code: string; issued_at: string; member_name: string; course_id: string };

function firstLessonOf(course: Course) {
  return course.modules?.[0]?.lessons?.[0] ?? null;
}

function completedCount(course: Course, completed: Set<string> | undefined) {
  if (!completed) return 0;
  let n = 0;
  for (const mod of course.modules ?? []) {
    for (const lesson of mod.lessons) if (completed.has(lesson.id)) n += 1;
  }
  return n;
}

function CertificadosPage() {
  const { progress, loaded } = useUserProgress();
  const { canOpen } = useCourseAccess();
  const [certs, setCerts] = useState<Record<string, CertRow>>({});
  const [certsLoaded, setCertsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (!cancelled) setCertsLoaded(true);
        return;
      }
      const { data } = await (supabase as unknown as { from: (t: string) => any })
        .from("course_certificates")
        .select("code, issued_at, member_name, course_id");
      if (cancelled) return;
      const map: Record<string, CertRow> = {};
      for (const row of (data as CertRow[]) ?? []) map[row.course_id] = row;
      setCerts(map);
      setCertsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    return allCourses
      .filter((c) => canOpen(c))
      .map((course) => {
        const bucket = progress[course.id];
        const total = computeLessonsCount(course);
        const done = completedCount(course, bucket?.completedLessons);
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;
        return {
          course,
          total,
          done,
          remaining: Math.max(total - done, 0),
          percent,
          cert: certs[course.id] ?? null,
        };
      })
      .sort((a, b) => b.percent - a.percent);
  }, [progress, canOpen, certs]);

  const ready = rows.filter((r) => r.remaining === 0 && r.total > 0);
  const issued = rows.filter((r) => r.cert);

  if (!loaded || !certsLoaded) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-3xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-primary">Conquistas</p>
        <h1 className="font-display text-3xl leading-tight text-foreground md:text-4xl">
          Os teus certificados
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Cada curso concluído a 100% liberta um certificado oficial MM Club com código público de
          verificação. Aqui vês o que já está pronto e quantas aulas faltam nos restantes.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Certificados emitidos" value={issued.length} />
        <StatCard label="Prontos a emitir" value={ready.length - issued.length < 0 ? 0 : ready.filter((r) => !r.cert).length} />
        <StatCard label="Cursos em progresso" value={rows.filter((r) => r.percent > 0 && r.remaining > 0).length} />
      </div>

      <section className="space-y-3">
        {rows.map((row) => (
          <CourseCertRow
            key={row.course.id}
            {...row}
            onIssued={(cert) => setCerts((prev) => ({ ...prev, [row.course.id]: cert }))}
          />
        ))}
        {rows.length === 0 && (
          <p className="rounded-3xl border border-border/60 bg-surface-1 p-6 text-sm text-muted-foreground">
            Ainda não tens cursos disponíveis.
          </p>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-border/60 bg-surface-1 p-4">
      <p className="font-display text-2xl text-foreground">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
    </div>
  );
}

function CourseCertRow({
  course,
  total,
  done,
  remaining,
  percent,
  cert,
  onIssued,
}: {
  course: Course;
  total: number;
  done: number;
  remaining: number;
  percent: number;
  cert: CertRow | null;
  onIssued: (cert: CertRow) => void;
}) {
  const [busy, setBusy] = useState(false);
  const hours = Math.round((parseDurationToMinutes(computeCourseDuration(course)) / 60) * 10) / 10;
  const lesson = firstLessonOf(course);

  const issue = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: unknown }>;
      }).rpc("issue_course_certificate", {
        _course_id: course.id,
        _course_title: course.title,
        _hours: hours,
        _lessons_total: total,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : null;
      if (row) {
        onIssued({ ...row, course_id: course.id });
        void sendCertificateEmail({ data: { code: row.code } }).catch(() => {});
      }
    } catch (error) {
      console.warn("Falha ao emitir certificado", error);
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!cert) return;
    setBusy(true);
    try {
      const res = await getCertificatePdf({ data: { code: cert.code } });
      const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn("Falha ao descarregar certificado", error);
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!cert) return;
    const url = `${window.location.origin}/certificado/${cert.code}`;
    const text = `Concluí o programa ${course.title} no MM Club.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Certificado MM Club", text, url });
        return;
      } catch {
        /* cancelado */
      }
    }
    await navigator.clipboard?.writeText(url).catch(() => {});
  };

  const complete = remaining === 0 && total > 0;

  return (
    <article
      className={`rounded-3xl border p-4 sm:p-5 ${
        cert || complete ? "border-primary/30 bg-primary/[0.06]" : "border-border/60 bg-surface-1"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            cert || complete ? "bg-primary/15 text-primary" : "bg-surface-2 text-muted-foreground"
          }`}
        >
          {cert ? <CheckCircle2 className="h-5 w-5" /> : <Award className="h-5 w-5" />}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-base text-foreground">{course.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {cert
              ? `Certificado emitido · código ${cert.code}`
              : complete
                ? "Curso concluído — podes emitir o certificado."
                : remaining === total
                  ? `Faltam ${remaining} ${remaining === 1 ? "aula" : "aulas"} para o certificado.`
                  : `${done} de ${total} aulas concluídas · faltam ${remaining} ${
                      remaining === 1 ? "aula" : "aulas"
                    }.`}
          </p>
          <div className="mt-2.5 flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
            <span className="text-[11px] tabular-nums text-muted-foreground">{percent}%</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          {cert ? (
            <>
              <button
                type="button"
                onClick={download}
                disabled={busy}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition hover:bg-gold-soft disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                PDF
              </button>
              <button
                type="button"
                onClick={share}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-surface-2 px-4 text-xs font-medium text-foreground transition hover:bg-surface-3"
              >
                <Share2 className="h-3.5 w-3.5" />
                Partilhar
              </button>
            </>
          ) : complete ? (
            <button
              type="button"
              onClick={issue}
              disabled={busy}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition hover:bg-gold-soft disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Award className="h-3.5 w-3.5" />}
              Emitir certificado
            </button>
          ) : lesson ? (
            <Link
              to="/academia/$courseId/$lessonId"
              params={{ courseId: course.id, lessonId: lesson.id }}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-surface-2 px-4 text-xs font-medium text-foreground transition hover:bg-surface-3"
            >
              <Play className="h-3.5 w-3.5" />
              Continuar curso
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
