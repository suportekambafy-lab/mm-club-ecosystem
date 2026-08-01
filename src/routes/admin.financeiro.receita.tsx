import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarList,
  money,
  Panel,
  RangeFilter,
  StatCard,
} from "@/components/admin/finance-ui";
import { getFinanceOverview } from "@/lib/admin-finance.functions";
import type { FinanceRange } from "@/lib/admin/finance-types";

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
  const [range, setRange] = useState<FinanceRange>("month");
  const { data, isLoading } = useQuery({
    queryKey: ["finance-overview", range],
    queryFn: () => fetchOverview({ data: { range } }),
  });

  if (isLoading || !data)
    return (
      <div className="space-y-4">
        <RangeFilter value={range} onChange={setRange} />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-2xl border border-border bg-surface-1"
            />
          ))}
        </div>
      </div>
    );

  const p = data.period;

  return (
    <div className="space-y-6">
      <RangeFilter value={range} onChange={setRange} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Receita · ${p.label}`}
          value={money(p.revenueCents)}
          tone="accent"
          hint={`${p.paymentsCount} pagamento(s)`}
        />
        <StatCard
          label="Ticket médio"
          value={p.avgTicketCents == null ? "—" : money(p.avgTicketCents)}
        />
        <StatCard label="Reembolsos no período" value={money(p.refundedCents)} />
        <StatCard
          label="Recuperado por dunning"
          value={money(data.dunningRecoveredCents)}
          tone="positive"
          hint={`${data.payments.recovered30d} recuperação(ões) em 30 d`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Por plano · ${p.label}`}>
          <BarList items={p.byPlan} emptyLabel="Sem receita neste período." />
        </Panel>
        <Panel title={`Por dia · ${p.label}`}>
          <BarList items={p.byDay} emptyLabel="Sem receita neste período." />
        </Panel>
        <Panel title={`Por país · ${p.label}`}>
          <BarList
            items={p.byCountry}
            emptyLabel="Sem país registado nos clientes."
          />
        </Panel>
        <Panel title={`Por cupão · ${p.label}`}>
          <BarList
            items={p.byCoupon}
            emptyLabel="Ainda sem receita associada a cupões."
          />
        </Panel>
        <Panel title={`Métodos de pagamento · ${p.label}`}>
          <BarList
            items={p.byMethod.map((m) => ({
              label: m.method,
              cents: m.cents,
              count: m.count,
            }))}
            emptyLabel="Sem pagamentos neste período."
          />
        </Panel>
        <Panel title="Histórico mensal (todo o tempo)">
          <BarList items={data.revenueByMonth} />
        </Panel>
      </section>
    </div>
  );
}
