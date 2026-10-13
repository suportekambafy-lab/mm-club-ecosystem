import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarList,
  money,
  Panel,
  RangeFilter,
  StatCard,
  STATUS_LABEL,
} from "@/components/admin/finance-ui";
import { getFinanceOverview } from "@/lib/admin-finance.functions";
import { sendPaymentMigrationEmails } from "@/lib/payment-migration.functions";
import type { FinanceRange } from "@/lib/admin/finance-types";
import type { SubscriptionStatus } from "@/lib/billing/types";


export const Route = createFileRoute("/admin/financeiro/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Visão geral financeira — MM Admin" },
      {
        name: "description",
        content:
          "Receita, MRR, ARR, churn e pagamentos do MM Club num único painel.",
      },
      { property: "og:title", content: "Visão geral financeira — MM Admin" },
      {
        property: "og:description",
        content: "Métricas de receita e subscrições do MM Club.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: OverviewPage,
});

const STATUS_ORDER: SubscriptionStatus[] = [
  "active",
  "trialing",
  "past_due",
  "grace_period",
  "suspended",
  "cancelled",
  "expired",
];

function pct(n: number | null) {
  return n == null ? "—" : `${(n * 100).toFixed(1)}%`;
}

function OverviewPage() {
  const fetchOverview = useServerFn(getFinanceOverview);
  const [range, setRange] = useState<FinanceRange>("30d");
  const { data, isLoading, error } = useQuery({
    queryKey: ["finance-overview", range],
    queryFn: () => fetchOverview({ data: { range } }),
    refetchInterval: 60_000,
  });

  if (error)
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
        {(error as Error).message}
      </div>
    );

  if (isLoading || !data)
    return (
      <div className="space-y-4">
        <RangeFilter value={range} onChange={setRange} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-border bg-surface-1"
            />
          ))}
        </div>
      </div>
    );

  const r = data.revenue;
  const p = data.period;
  const growth =
    r.prevMonthCents > 0
      ? (r.monthCents - r.prevMonthCents) / r.prevMonthCents
      : null;

  return (
    <div className="space-y-6">
      <MigrationEmailCard />
      <RangeFilter value={range} onChange={setRange} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Receita · ${p.label}`}
          value={money(p.revenueCents)}
          tone="accent"
          hint={`${p.paymentsCount} pagamento(s)${p.avgTicketCents != null ? ` · média ${money(p.avgTicketCents)}` : ""}`}
        />
        <StatCard
          label={`Novas subscrições · ${p.label}`}
          value={p.newSubs}
          tone="positive"
        />
        <StatCard
          label={`Cancelamentos · ${p.label}`}
          value={p.cancellations}
          tone={p.cancellations > 0 ? "negative" : "default"}
        />
        <StatCard
          label={`Falhados / reembolsos · ${p.label}`}
          value={p.failedCount}
          hint={`${money(p.refundedCents)} reembolsado · ${p.chargebacksCount} chargeback(s)`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Receita por plano · ${p.label}`}>
          <BarList items={p.byPlan} emptyLabel="Sem receita neste período." />
        </Panel>
        <Panel title={`Receita por dia · ${p.label}`}>
          <BarList items={p.byDay} emptyLabel="Sem receita neste período." />
        </Panel>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

        <StatCard label="Receita hoje" value={money(r.todayCents)} hint={`${data.payments.todayCount} pagamento(s)`} />
        <StatCard
          label="Receita este mês"
          value={money(r.monthCents)}
          hint={
            growth == null
              ? "Sem mês anterior para comparar"
              : `${growth >= 0 ? "+" : ""}${(growth * 100).toFixed(1)}% vs mês anterior`
          }
        />
        <StatCard label="MRR" value={money(r.mrrCents)} tone="accent" hint="Receita recorrente mensal normalizada" />
        <StatCard label="ARR" value={money(r.arrCents)} hint="MRR × 12" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Membros ativos"
          value={data.members.activeSubscribers}
          hint={`${data.members.trialing} em trial`}
        />
        <StatCard label="Novas subscrições (30 d)" value={data.members.newSubs30d} tone="positive" />
        <StatCard label="Cancelamentos (30 d)" value={data.members.cancellations30d} tone={data.members.cancellations30d > 0 ? "negative" : "default"} />
        <StatCard
          label="Churn (30 d)"
          value={pct(data.members.churnRate)}
          hint="Cancelamentos / base no início do período"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel title="Pagamentos" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Hoje" value={`${data.payments.todayCount}`} hint={money(data.payments.todayCents)} />
            <StatCard label="Falhados (30 d)" value={data.payments.failed30d} tone={data.payments.failed30d > 0 ? "negative" : "default"} />
            <StatCard label="Recuperados (dunning)" value={data.payments.recovered30d} hint={money(data.dunningRecoveredCents)} tone="positive" />
            <StatCard label="Reembolsos (30 d)" value={money(data.payments.refunded30dCents)} />
            <StatCard label="Chargebacks (30 d)" value={data.payments.chargebacks30d} tone={data.payments.chargebacks30d > 0 ? "negative" : "default"} />
            <StatCard
              label="LTV médio"
              value={r.ltvCents == null ? "—" : money(r.ltvCents)}
              hint={
                r.ltvCents == null
                  ? `Precisa de ≥5 clientes (tem ${r.ltvSampleSize})`
                  : `Base: ${r.ltvSampleSize} clientes`
              }
            />
          </div>

          <div className="mt-5">
            <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Métodos de pagamento
            </p>
            <BarList
              items={data.payments.byMethod.map((m) => ({
                label: m.method,
                cents: m.cents,
                count: m.count,
              }))}
              emptyLabel="Ainda sem pagamentos."
            />
          </div>
        </Panel>

        <Panel
          title="Subscrições"
          action={
            <Link
              to="/admin/financeiro/subscricoes"
              className="text-xs text-primary hover:underline"
            >
              Ver todas
            </Link>
          }
        >
          <ul className="space-y-2">
            {STATUS_ORDER.map((s) => (
              <li key={s} className="flex items-center justify-between text-sm">
                <Link
                  to="/admin/financeiro/subscricoes"
                  search={{ status: s } as never}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {STATUS_LABEL[s]}
                </Link>
                <span className="tabular-nums font-medium">
                  {data.subscriptionsByStatus[s] ?? 0}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Receita por plano">
          <BarList items={data.revenueByPlan} />
        </Panel>
        <Panel title="Receita por mês">
          <BarList items={data.revenueByMonth.slice(-12)} />
        </Panel>
      </section>

      <p className="text-xs text-muted-foreground">
        Atualizado em {new Date(data.generatedAt).toLocaleString("pt-PT")}.
      </p>
    </div>
  );
}

function MigrationEmailCard() {
  const send = useServerFn(sendPaymentMigrationEmails);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
      <div className="flex-1 text-sm">
        <strong>Migração para o Paddle.</strong> Envia o email "Atualiza o teu método de
        pagamento" a todos os membros que ainda estão na Mollie (cada pessoa recebe só uma vez).
        {msg ? <div className="mt-1 text-muted-foreground">{msg}</div> : null}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (!confirm("Enviar o email a todos os membros ainda na Mollie?")) return;
          setBusy(true);
          try {
            const r = await send();
            setMsg(`Enviados ${r.sent} de ${r.total} · já recebidos/sem email ${r.skipped} · falhas ${r.failed}`);
          } catch {
            setMsg("Não foi possível enviar agora. Tenta de novo.");
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {busy ? "A enviar…" : "Enviar comunicado"}
      </button>
    </section>
  );
}
