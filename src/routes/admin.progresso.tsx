import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, GraduationCap, Search } from "lucide-react";
import { getProgressOverview, getStudentCourseLessons } from "@/lib/admin-progress.functions";
import type { StudentProgressRow } from "@/lib/admin/progress-types";
import { ProgressCharts, type BucketRange } from "@/components/admin/progress-charts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/progresso")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Progresso dos alunos — MM Admin" },
      {
        name: "description",
        content:
          "Progresso de cada aluno do MM Club: cursos em andamento, aulas concluídas e aula atual.",
      },
      { property: "og:title", content: "Progresso dos alunos — MM Admin" },
      {
        property: "og:description",
        content: "Acompanhamento de progresso por aluno e por curso no MM Club.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ProgressPage,
});

type SortKey = "recent" | "progress" | "lessons" | "time" | "name";

function hours(seconds: number): string {
  if (seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function when(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

function Bar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-admin-panel-2">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          percent >= 100 ? "bg-emerald-500" : percent >= 40 ? "bg-primary" : "bg-amber-500",
        )}
        style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
      />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-admin-panel p-4">
      <p className="text-[12px] text-admin-faint">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-admin-fg">{value}</p>
      {hint ? <p className="mt-0.5 text-[12px] text-admin-muted">{hint}</p> : null}
    </div>
  );
}

function LessonDetail({ userId, courseId }: { userId: string; courseId: string }) {
  const load = useServerFn(getStudentCourseLessons);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-progress-lessons", userId, courseId],
    queryFn: () => load({ data: { userId, courseId } }),
    staleTime: 60_000,
  });

  if (isLoading) return <p className="mt-2 text-[12px] text-admin-faint">A carregar aulas…</p>;
  if (error)
    return (
      <p className="mt-2 text-[12px] text-red-400">
        Não foi possível carregar as aulas: {(error as Error).message}
      </p>
    );
  if (!data || data.length === 0)
    return <p className="mt-2 text-[12px] text-admin-faint">Sem aulas registadas.</p>;

  return (
    <ul className="mt-2 space-y-1">
      {data.map((l) => (
        <li key={l.lessonId} className="flex items-center gap-2 rounded-lg bg-admin-panel px-2 py-1.5">
          <span className="w-6 shrink-0 text-right text-[11px] text-admin-faint">{l.index}</span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-admin-fg">{l.title}</span>
          <span className="hidden w-28 shrink-0 sm:block">
            <Bar percent={l.percent} />
          </span>
          <span className="w-24 shrink-0 text-right text-[11px] text-admin-muted">
            {clock(l.watchedSeconds)}
            {l.durationSeconds > 0 ? ` / ${clock(l.durationSeconds)}` : ""}
          </span>
          <span
            className={cn(
              "w-20 shrink-0 rounded-full px-2 py-0.5 text-center text-[10px]",
              l.completed
                ? "bg-emerald-500/15 text-emerald-400"
                : l.percent > 0
                  ? "bg-primary/15 text-primary"
                  : "bg-admin-panel-2 text-admin-faint",
            )}
          >
            {l.completed ? "Concluída" : l.percent > 0 ? `${l.percent}%` : "Não vista"}
          </span>
          <span className="hidden w-20 shrink-0 text-right text-[11px] text-admin-faint md:block">
            {when(l.lastWatchedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function StudentCard({
  student,
  defaultOpen = false,
  focusCourseId,
}: {
  student: StudentProgressRow;
  defaultOpen?: boolean;
  focusCourseId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [openCourse, setOpenCourse] = useState<string | null>(focusCourseId ?? null);
  return (
    <div className="rounded-xl bg-admin-panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <MemberAvatar name={student.name} avatarUrl={student.avatarUrl} size={36} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-admin-fg">{student.name}</p>
          <p className="truncate text-[12px] text-admin-muted">
            {student.activeCourseTitle ?? "—"}
            {student.activeLessonTitle ? ` · ${student.activeLessonTitle}` : ""}
          </p>
        </div>

        <div className="hidden w-40 shrink-0 sm:block">
          <Bar percent={student.overallPercent} />
          <p className="mt-1 text-right text-[11px] text-admin-faint">
            {student.overallPercent}% · {student.totalCompleted} aulas
          </p>
        </div>

        <div className="hidden w-24 shrink-0 text-right text-[12px] text-admin-muted md:block">
          {hours(student.watchedSeconds)}
        </div>
        <div className="w-20 shrink-0 text-right text-[12px] text-admin-faint">
          {when(student.lastActivityAt)}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-admin-faint transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="space-y-2 border-t border-admin-border p-3">
          {student.courses.map((c) => (
            <div key={c.courseId} className="rounded-lg bg-admin-panel-2 p-3">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[13px] text-admin-fg">{c.courseTitle}</p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px]",
                    c.finished
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-primary/15 text-primary",
                  )}
                >
                  {c.finished ? "Concluído" : `${c.percent}%`}
                </span>
              </div>
              <div className="mt-2">
                <Bar percent={c.percent} />
              </div>
              <button
                type="button"
                onClick={() => setOpenCourse((v) => (v === c.courseId ? null : c.courseId))}
                className="mt-2 text-[12px] text-primary underline-offset-2 hover:underline"
              >
                {openCourse === c.courseId ? "Esconder aulas" : "Ver progresso por aula"}
              </button>
              {openCourse === c.courseId ? (
                <LessonDetail userId={student.userId} courseId={c.courseId} />
              ) : null}
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-[12px] sm:grid-cols-2">
                <div className="flex justify-between gap-2">
                  <dt className="text-admin-faint">Aulas concluídas</dt>
                  <dd className="text-admin-fg">
                    {c.completedLessons}/{c.totalLessons}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-admin-faint">Aulas iniciadas</dt>
                  <dd className="text-admin-fg">{c.startedLessons}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-admin-faint">Está na aula</dt>
                  <dd className="truncate text-admin-fg">
                    {c.currentLessonTitle
                      ? `${c.currentLessonIndex ? `${c.currentLessonIndex}. ` : ""}${c.currentLessonTitle} (${clock(c.currentLessonSeconds)})`
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-admin-faint">Próxima aula</dt>
                  <dd className="truncate text-admin-fg">
                    {c.nextLessonTitle
                      ? `${c.nextLessonIndex ? `${c.nextLessonIndex}. ` : ""}${c.nextLessonTitle}`
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-admin-faint">Tempo visto</dt>
                  <dd className="text-admin-fg">{hours(c.watchedSeconds)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-admin-faint">Última atividade</dt>
                  <dd className="text-admin-fg">{when(c.lastWatchedAt)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProgressPage() {
  const load = useServerFn(getProgressOverview);
  const [term, setTerm] = useState("");
  const [courseId, setCourseId] = useState("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [bucket, setBucket] = useState<BucketRange | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-progress"],
    queryFn: () => load(),
    staleTime: 60_000,
  });

  const students = useMemo(() => {
    const q = term.trim().toLowerCase();
    let list = (data?.students ?? []).filter((s) => {
      if (courseId !== "all" && !s.courses.some((c) => c.courseId === courseId)) return false;
      if (bucket) {
        const value =
          courseId === "all"
            ? s.overallPercent
            : (s.courses.find((c) => c.courseId === courseId)?.percent ?? 0);
        if (value < bucket.min || value > bucket.max) return false;
      }
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.courses.some((c) => c.courseTitle.toLowerCase().includes(q))
      );
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "progress":
          return b.overallPercent - a.overallPercent;
        case "lessons":
          return b.totalCompleted - a.totalCompleted;
        case "time":
          return b.watchedSeconds - a.watchedSeconds;
        case "name":
          return a.name.localeCompare(b.name);
        default:
          return (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? "");
      }
    });
    return list;
  }, [data, term, courseId, sort, bucket]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.02em] text-admin-fg">
          <GraduationCap strokeWidth={1.6} className="h-[18px] w-[18px]" />
          Progresso dos alunos
        </h1>
        <p className="mt-1 text-[13px] text-admin-muted">
          Quem está a estudar, em que curso, quantas aulas concluiu e em que aula está agora.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl bg-admin-panel p-4 text-[13px] text-red-400">
          Não foi possível carregar o progresso: {(error as Error).message}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Alunos com atividade"
          value={isLoading ? "…" : String(data?.totalStudents ?? 0)}
          hint={`${data?.catalogLessons ?? 0} aulas no catálogo`}
        />
        <Stat
          label="Ativos (7 dias)"
          value={isLoading ? "…" : String(data?.activeLast7Days ?? 0)}
          hint={`${data?.activeLast30Days ?? 0} nos últimos 30 dias`}
        />
        <Stat
          label="Aulas concluídas"
          value={isLoading ? "…" : String(data?.totalCompletions ?? 0)}
        />
        <Stat
          label="Tempo total visto"
          value={isLoading ? "…" : hours(data?.totalWatchedSeconds ?? 0)}
        />
      </div>

      {/* Gráficos */}
      {data ? (
        <ProgressCharts
          data={data}
          courseId={courseId}
          activeBucket={bucket?.name ?? null}
          onSelectCourse={(id) => {
            setCourseId(id);
            setBucket(null);
            document.getElementById("mm-alunos")?.scrollIntoView({ behavior: "smooth" });
          }}
          onSelectBucket={(range) => {
            setBucket(range);
            if (range) document.getElementById("mm-alunos")?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      ) : null}

      {courseId !== "all" || bucket ? (
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-admin-faint">A ver:</span>
          {courseId !== "all" ? (
            <button
              type="button"
              onClick={() => setCourseId("all")}
              className="rounded-full bg-primary/15 px-2.5 py-1 text-primary"
            >
              {data?.courses.find((c) => c.courseId === courseId)?.courseTitle ?? courseId} ✕
            </button>
          ) : null}
          {bucket ? (
            <button
              type="button"
              onClick={() => setBucket(null)}
              className="rounded-full bg-primary/15 px-2.5 py-1 text-primary"
            >
              Conclusão {bucket.name} ✕
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Por curso */}
      <div className="rounded-xl bg-admin-panel">
        <p className="px-4 pt-4 text-[13px] font-medium text-admin-fg">Por curso</p>
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-admin-faint">
                <th className="pb-2 font-normal">Curso</th>
                <th className="pb-2 font-normal">Alunos</th>
                <th className="pb-2 font-normal">Concluíram</th>
                <th className="pb-2 font-normal">Progresso médio</th>
                <th className="pb-2 font-normal">Aulas concluídas</th>
                <th className="pb-2 font-normal">Última atividade</th>
              </tr>
            </thead>
            <tbody>
              {(data?.courses ?? []).map((c) => (
                <tr
                  key={c.courseId}
                  onClick={() => {
                    setCourseId(c.courseId);
                    setBucket(null);
                    document.getElementById("mm-alunos")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={cn(
                    "cursor-pointer border-t border-admin-border transition-colors hover:bg-admin-panel-2",
                    courseId === c.courseId && "bg-admin-panel-2",
                  )}
                >
                  <td className="py-2 pr-3 text-admin-fg">{c.courseTitle}</td>
                  <td className="py-2 pr-3 text-admin-muted">{c.students}</td>
                  <td className="py-2 pr-3 text-admin-muted">{c.finishers}</td>
                  <td className="w-40 py-2 pr-3">
                    <Bar percent={c.avgPercent} />
                    <span className="text-[11px] text-admin-faint">{c.avgPercent}%</span>
                  </td>
                  <td className="py-2 pr-3 text-admin-muted">
                    {c.completions}/{c.totalLessons * Math.max(1, c.students)}
                  </td>
                  <td className="py-2 text-admin-faint">{when(c.lastActivityAt)}</td>
                </tr>
              ))}
              {!isLoading && (data?.courses ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-admin-faint">
                    Ainda não há progresso registado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-faint" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Procurar aluno ou curso…"
            className="h-9 w-60 rounded-xl bg-admin-panel pl-9 pr-3 text-[13px] text-admin-fg outline-none ring-primary/40 placeholder:text-admin-faint focus:ring-2"
          />
        </div>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="h-9 rounded-xl bg-admin-panel px-3 text-[13px] text-admin-fg outline-none"
        >
          <option value="all">Todos os cursos</option>
          {(data?.courses ?? []).map((c) => (
            <option key={c.courseId} value={c.courseId}>
              {c.courseTitle}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-9 rounded-xl bg-admin-panel px-3 text-[13px] text-admin-fg outline-none"
        >
          <option value="recent">Atividade recente</option>
          <option value="progress">Maior progresso</option>
          <option value="lessons">Mais aulas concluídas</option>
          <option value="time">Mais tempo visto</option>
          <option value="name">Nome</option>
        </select>
        <span className="ml-auto text-[12px] text-admin-faint">
          {students.length} {students.length === 1 ? "aluno" : "alunos"}
        </span>
      </div>

      {/* Alunos */}
      <div id="mm-alunos" className="space-y-2">
        {isLoading ? (
          <div className="rounded-xl bg-admin-panel p-6 text-center text-[13px] text-admin-faint">
            A carregar progresso…
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-xl bg-admin-panel p-6 text-center text-[13px] text-admin-faint">
            Nenhum aluno encontrado.
          </div>
        ) : (
          students.map((s) => (
            <StudentCard
              key={s.userId}
              student={s}
              defaultOpen={courseId !== "all" || Boolean(bucket)}
              {...(courseId !== "all" ? { focusCourseId: courseId } : {})}
            />
          ))
        )}
      </div>
    </div>
  );
}
