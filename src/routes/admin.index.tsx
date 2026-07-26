import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  PlayCircle,
  CalendarDays,
  Radio,
  Wrench,
  Sparkles,
  ArrowUpRight,
  BarChart3,
  CircleDollarSign,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money } from "@/components/admin/finance-ui";
import { getFinanceOverview } from "@/lib/admin-finance.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Início — MM Admin" },
      {
        name: "description",
        content:
          "Visão geral do MM Club: receita, MRR, subscrições e atividade recente.",
      },
      { property: "og:title", content: "Início — MM Admin" },
      {
        property: "og:description",
        content: "Métricas de negócio do MM Club num único painel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminDashboard,
});

const shortcuts = [
  { to: "/admin/cursos" as const, label: "Cursos", icon: BookOpen },
  { to: "/admin/aulas" as const, label: "Aulas", icon: PlayCircle },
  { to: "/admin/transcricoes" as const, label: "Transcrições", icon: Sparkles },
  { to: "/admin/eventos" as const, label: "Eventos", icon: CalendarDays },
  { to: "/admin/lives" as const, label: "Lives", icon: Radio },
  { to: "/admin/ferramentas" as const, label: "Ferramentas", icon: Wrench },
];

function pct(n: number | null) {
  return n == null ? "—" : `${(n * 100).toFixed(1)}%`;
}

/** Big display amount with a smaller decimal tail, like the reference. */
function BigMoney({ cents }: { cents: number }) {
  const [int, dec] = (cents / 100)
    .toLocaleString("pt-PT", { minimumFractionDigits: 2 })
    .split(",");
  return (
    <p className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
      €{int}
      <span className="text-2xl text-muted-foreground md:text-3xl">,{dec}</span>
    </p>
  );
}

const MONTHS = [
  "jan.",
  "fev.",
  "mar.",
  "abr.",
  "mai.",
  "jun.",
  "jul.",
  "ago.",
  "set.",
  "out.",
  "nov.",
  "dez.",
];

function AdminDashboard() {
  const fetchOverview = useServerFn(getFinanceOverview);
  const [range, setRange] = useState<"mes" | "ano">("mes");
  const { data, isLoading, error } = useQuery({
    queryKey: ["finance-overview"],
    queryFn: () => fetchOverview({ data: undefined as never }),
    refetchInterval: 60_000,
  });

  const now = new Date();
  const monthLabel = `${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
  const prevDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const prevLabel = `${MONTHS[prevDate.getUTCMonth()]} ${prevDate.getUTCFullYear()}`;

  const chartData =
    range === "mes"
      ? (data?.dailySeries ?? []).map((d) => ({
          label: String(d.day),
          atual: d.cents / 100,
          anterior: d.prevCents / 100,
        }))
      : (data?.revenueByMonth ?? []).map((m) => ({
          label: m.label,
          atual: m.cents / 100,
          anterior: 0,
        }));

  const delta =
    data && data.revenue.prevMonthCents > 0
      ? (data.revenue.monthCents - data.revenue.prevMonthCents) /
        data.revenue.prevMonthCents
      : null;

  return (
    <div className="space-y-4">
      {/* Balance band */}
      <section className="rounded-2xl border border-border bg-surface-1 px-6 py-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleDollarSign className="h-4 w-4 text-primary" />
          Receita total (30 dias)
        </div>
        <div className="mt-3">
          {isLoading || !data ? (
            <Skeleton className="h-12 w-64" />
          ) : (
            <BigMoney cents={data.revenue.last30Cents} />
          )}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          MRR atual{" "}
          <span className="text-foreground">
            {data ? money(data.revenue.mrrCents) : "—"}
          </span>{" "}
          ·{" "}
          <Link
            to="/admin/financeiro/receita"
            className="inline-flex items-center gap-1 text-foreground hover:text-primary"
          >
            ver receita <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </p>
      </section>

      {/* Chart band */}
      <section className="rounded-2xl border border-border bg-surface-1 px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              Vendas
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              {isLoading || !data ? (
                <Skeleton className="h-8 w-40" />
              ) : (
                <>
                  <p className="font-display text-3xl font-semibold tracking-tight">
                    {money(data.revenue.monthCents)}
                  </p>
                  {delta != null && (
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        delta >= 0 ? "text-emerald-400" : "text-rose-400",
                      )}
                    >
                      {delta >= 0 ? "↑" : "↓"} {Math.abs(delta * 100).toFixed(0)}%
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex rounded-lg border border-border bg-surface-2 p-0.5">
            {(["mes", "ano"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs transition",
                  range === r
                    ? "bg-surface-1 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r === "mes" ? "Mês" : "Ano"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 h-[320px] w-full">
          {isLoading || !data ? (
            <Skeleton className="h-full w-full rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="var(--hairline)"
                  vertical={false}
                  strokeDasharray="0"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ stroke: "var(--hairline)" }}
                  contentStyle={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--muted-foreground)" }}
                  formatter={(v: number) => `€${v.toFixed(2)}`}
                />
                <Line
                  type="linear"
                  dataKey="atual"
                  name={monthLabel}
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={false}
                />
                {range === "mes" && (
                  <Line
                    type="linear"
                    dataKey="anterior"
                    name={prevLabel}
                    stroke="var(--muted-foreground)"
                    strokeWidth={1.5}
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-4 flex items-center gap-5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {monthLabel}
          </span>
          {range === "mes" && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              {prevLabel}
            </span>
          )}
        </div>
      </section>

      {error ? (
        <p className="rounded-2xl border border-border bg-surface-1 p-5 text-sm text-muted-foreground">
          Não foi possível carregar as métricas.
        </p>
      ) : null}

      {/* Metric rows */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
        {[
          { label: "MRR", value: data ? money(data.revenue.mrrCents) : "—" },
          { label: "ARR", value: data ? money(data.revenue.arrCents) : "—" },
          {
            label: "Subscritores ativos",
            value: data ? String(data.members.activeSubscribers) : "—",
          },
          { label: "Churn", value: data ? pct(data.members.churnRate) : "—" },
          {
            label: "Novas 30d",
            value: data ? String(data.members.newSubs30d) : "—",
          },
          {
            label: "Cancelamentos 30d",
            value: data ? String(data.members.cancellations30d) : "—",
          },
          {
            label: "Falhados 30d",
            value: data ? String(data.payments.failed30d) : "—",
          },
          {
            label: "LTV",
            value:
              data && data.revenue.ltvCents != null
                ? money(data.revenue.ltvCents)
                : "—",
          },
        ].map((m) => (
          <div key={m.label} className="bg-surface-1 px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {m.label}
            </p>
            <p className="mt-1.5 font-display text-lg tabular-nums">{m.value}</p>
          </div>
        ))}
      </section>

      {/* Content shortcuts */}
      <section className="space-y-3 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Gestão de conteúdo
        </p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          {shortcuts.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.to}
                to={s.to}
                className="group flex items-center gap-2.5 rounded-xl border border-border bg-surface-1 px-3.5 py-3 text-[13px] transition hover:border-primary/40 hover:bg-surface-2"
              >
                <Icon className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
                <span className="truncate">{s.label}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
