import { createFileRoute, Link } from "@tanstack/react-router";
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
} from "lucide-react";
import {
  BarList,
  money,
  Panel,
  StatCard,
  STATUS_LABEL,
} from "@/components/admin/finance-ui";
import { getFinanceOverview } from "@/lib/admin-finance.functions";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — MM Admin" },
      {
        name: "description",
        content:
          "Visão geral do MM Club: receita, MRR, subscrições e atividade recente.",
      },
      { property: "og:title", content: "Dashboard — MM Admin" },
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

function AdminDashboard() {
  const fetchOverview = useServerFn(getFinanceOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["finance-overview"],
    queryFn: () => fetchOverview({ data: undefined as never }),
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            MM Club
          </p>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">
            Dashboard
          </h1>
        </div>
        <Link
          to="/admin/financeiro"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-3.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
        >
          Ver relatórios financeiros
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {error ? (
        <div className="rounded-2xl border border-border bg-surface-1 p-5 text-sm text-muted-foreground">
          Não foi possível carregar as métricas.
        </div>
      ) : isLoading || !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Receita hoje"
              value={money(data.revenue.todayCents)}
              hint={`${data.payments.todayCount} pagamentos`}
              tone="accent"
            />
            <StatCard
              label="MRR"
              value={money(data.revenue.mrrCents)}
              hint={`ARR ${money(data.revenue.arrCents)}`}
            />
            <StatCard
              label="Receita 30 dias"
              value={money(data.revenue.last30Cents)}
              hint={`Mês anterior ${money(data.revenue.prevMonthCents)}`}
            />
            <StatCard
              label="Subscritores ativos"
              value={data.members.activeSubscribers}
              hint={`${data.members.trialing} em trial`}
            />
          </section>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Novas subscrições 30d"
              value={data.members.newSubs30d}
              tone="positive"
            />
            <StatCard
              label="Cancelamentos 30d"
              value={data.members.cancellations30d}
              tone={data.members.cancellations30d > 0 ? "negative" : "default"}
            />
            <StatCard label="Churn" value={pct(data.members.churnRate)} />
            <StatCard
              label="LTV"
              value={data.revenue.ltvCents == null ? "—" : money(data.revenue.ltvCents)}
              hint={`${data.revenue.ltvSampleSize} clientes`}
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Receita por mês" className="lg:col-span-2">
              <BarList items={data.revenueByMonth} />
            </Panel>
            <Panel title="Subscrições por estado">
              <div className="space-y-2 text-sm">
                {Object.entries(data.subscriptionsByStatus).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {STATUS_LABEL[k] ?? k}
                    </span>
                    <span className="tabular-nums">{v}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Receita por plano">
              <BarList items={data.revenueByPlan} />
            </Panel>
            <Panel
              title="Pagamentos"
              action={
                <Link
                  to="/admin/saude"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Saúde do billing
                </Link>
              }
            >
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Metric label="Falhados 30d" value={String(data.payments.failed30d)} />
                <Metric label="Recuperados 30d" value={String(data.payments.recovered30d)} />
                <Metric
                  label="Reembolsos 30d"
                  value={money(data.payments.refunded30dCents)}
                />
                <Metric
                  label="Chargebacks 30d"
                  value={String(data.payments.chargebacks30d)}
                />
              </div>
            </Panel>
          </div>
        </>
      )}

      <section className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Gestão de conteúdo
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {shortcuts.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.to}
                to={s.to}
                className="group flex items-center gap-2.5 rounded-xl border border-border bg-surface-1 px-3.5 py-3 text-sm transition hover:border-primary/40 hover:bg-surface-2"
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 tabular-nums">{value}</p>
    </div>
  );
}
