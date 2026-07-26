import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarList, money, Panel, StatCard } from "@/components/admin/finance-ui";
import { getFinanceOverview } from "@/lib/admin-finance.functions";

export const Route = createFileRoute("/admin/financeiro/receita")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Receita — MM Admin" },
      {
        name: "description",
        content:
          "Receita do MM Club por plano, período, país, cupão e recuperação por dunning.",
      },
      { property: "og:title", content: "Receita — MM Admin" },
      {
        property: "og:description",
        content: "Análise de receita do MM Club.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: RevenuePage,
});

function RevenuePage() {
  const fetchOverview = useServerFn(getFinanceOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["finance-overview"],
    queryFn: () => fetchOverview({ data: undefined as never }),
  });

  if (isLoading || !data)
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-56 animate-pulse rounded-2xl border border-border bg-surface-1"
          />
        ))}
      </div>
    );

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Últimos 30 dias" value={money(data.revenue.last30Cents)} />
        <StatCard label="Este mês" value={money(data.revenue.monthCents)} />
        <StatCard label="Mês anterior" value={money(data.revenue.prevMonthCents)} />
        <StatCard
          label="Recuperado por dunning"
          value={money(data.dunningRecoveredCents)}
          tone="positive"
          hint={`${data.payments.recovered30d} recuperação(ões) em 30 d`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Por plano">
          <BarList items={data.revenueByPlan} />
        </Panel>
        <Panel title="Por período (mensal)">
          <BarList items={data.revenueByMonth} />
        </Panel>
        <Panel title="Por país">
          <BarList
            items={data.revenueByCountry}
            emptyLabel="Sem país registado nos clientes."
          />
        </Panel>
        <Panel title="Por cupão">
          <BarList
            items={data.revenueByCoupon}
            emptyLabel="Ainda sem receita associada a cupões."
          />
        </Panel>
      </section>
    </div>
  );
}
