/**
 * Gráficos do painel "Progresso dos alunos".
 * Evolução diária (global ou por curso), conclusão média por curso e
 * distribuição dos alunos por faixa de conclusão.
 */
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CourseAggregate, ProgressOverview, StudentProgressRow } from "@/lib/admin/progress-types";

const AXIS = "hsl(var(--muted-foreground))";

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-admin-panel p-4">
      <p className="text-[13px] font-medium text-admin-fg">{title}</p>
      {hint ? <p className="mt-0.5 text-[12px] text-admin-faint">{hint}</p> : null}
      <div className="mt-3 h-[220px]">{children}</div>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 12,
    fontSize: 12,
  },
  labelStyle: { color: "hsl(var(--muted-foreground))" },
} as const;

function shortDate(date: string) {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

export function ProgressCharts({
  data,
  courseId,
}: {
  data: ProgressOverview;
  courseId: string;
}) {
  const timeline = useMemo(() => {
    const source =
      courseId === "all"
        ? data.timeline
        : (data.timelineByCourse.find((c) => c.courseId === courseId)?.points ?? []);
    return source.map((p) => ({ ...p, label: shortDate(p.date) }));
  }, [data, courseId]);

  const courseBars = useMemo(
    () =>
      [...(data.courses as CourseAggregate[])]
        .sort((a, b) => b.avgPercent - a.avgPercent)
        .slice(0, 12)
        .map((c) => ({
          name: c.courseTitle.length > 22 ? `${c.courseTitle.slice(0, 21)}…` : c.courseTitle,
          fullName: c.courseTitle,
          percent: c.avgPercent,
          students: c.students,
        })),
    [data.courses],
  );

  const buckets = useMemo(() => {
    const students: StudentProgressRow[] =
      courseId === "all"
        ? data.students
        : data.students.filter((s) => s.courses.some((c) => c.courseId === courseId));
    const ranges = [
      { name: "0–20%", min: 0, max: 20 },
      { name: "21–40%", min: 21, max: 40 },
      { name: "41–60%", min: 41, max: 60 },
      { name: "61–80%", min: 61, max: 80 },
      { name: "81–99%", min: 81, max: 99 },
      { name: "100%", min: 100, max: 100 },
    ];
    return ranges.map((r) => ({
      name: r.name,
      alunos: students.filter((s) => {
        const value =
          courseId === "all"
            ? s.overallPercent
            : (s.courses.find((c) => c.courseId === courseId)?.percent ?? 0);
        return value >= r.min && value <= r.max;
      }).length,
      done: r.max === 100,
    }));
  }, [data.students, courseId]);

  const scope = courseId === "all" ? "todos os cursos" : (courseBars.find(() => true) ? "curso selecionado" : "curso selecionado");

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <Panel
          title="Evolução (últimos 30 dias)"
          hint={`Aulas concluídas e alunos ativos por dia — ${scope}.`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="mmProgressFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: AXIS }}
                interval="preserveStartEnd"
                stroke="hsl(var(--border))"
              />
              <YAxis tick={{ fontSize: 11, fill: AXIS }} stroke="hsl(var(--border))" allowDecimals={false} />
              <Tooltip
                {...tooltipStyle}
                formatter={(value: number, name: string) => [
                  value,
                  name === "lessonsCompleted"
                    ? "Aulas concluídas"
                    : name === "activeStudents"
                      ? "Alunos ativos"
                      : "Horas vistas",
                ]}
              />
              <Area
                type="monotone"
                dataKey="lessonsCompleted"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#mmProgressFill)"
              />
              <Line
                type="monotone"
                dataKey="activeStudents"
                stroke={AXIS}
                strokeWidth={1.6}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title="Conclusão média por curso" hint="Percentagem média de aulas concluídas.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={courseBars}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: AXIS }}
              stroke="hsl(var(--border))"
            />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              tick={{ fontSize: 11, fill: AXIS }}
              stroke="hsl(var(--border))"
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(value: number) => [`${value}%`, "Conclusão média"]}
              labelFormatter={(label: string) =>
                courseBars.find((c) => c.name === label)?.fullName ?? label
              }
            />
            <Bar dataKey="percent" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel
        title="Distribuição dos alunos"
        hint="Quantos alunos estão em cada faixa de conclusão."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: AXIS }} stroke="hsl(var(--border))" />
            <YAxis tick={{ fontSize: 11, fill: AXIS }} stroke="hsl(var(--border))" allowDecimals={false} />
            <Tooltip {...tooltipStyle} formatter={(value: number) => [value, "Alunos"]} />
            <Bar dataKey="alunos" radius={[6, 6, 0, 0]} barSize={28}>
              {buckets.map((b) => (
                <Cell
                  key={b.name}
                  fill={b.done ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.45)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}
