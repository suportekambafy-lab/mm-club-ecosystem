import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import {
  day as dayLabel,
  dt,
  money,
  Panel,
  RangeFilter,
  StatCard,
  StatusBadge,
} from "@/components/admin/finance-ui";
import { getChargeLog, listUpcomingCharges } from "@/lib/admin-finance.functions";
import type { ChargeLogRow, FinanceRange } from "@/lib/admin/finance-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/financeiro/cobrancas")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cobranças do dia — MM Admin" },
      {
        name: "description",
        content:
          "Quem foi debitado, quanto entrou e quem será cobrado a seguir no MM Club.",
      },
      { property: "og:title", content: "Cobranças do dia — MM Admin" },
      {
        property: "og:description",
        content: "Registo claro de débitos pagos, falhados e agendados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ChargesPage,
});

type Filter = "all" | "paid" | "failed" | "pending";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "paid", label: "Pagas" },
  { value: "failed", label: "Falhadas" },
  { value: "pending", label: "Pendentes" },
];

function matches(row: ChargeLogRow, f: Filter) {
  if (f === "all") return true;
  if (f === "paid") return row.status === "paid";
  if (f === "pending")
    return row.status === "pending" || row.status === "authorized";
  return !["paid", "pending", "authorized"].includes(row.status);
}

function who(row: { name: string | null; email: string | null; userId: string }) {
  return row.name ?? row.email ?? row.userId.slice(0, 8);
}

function ChargesPage() {
  const fetchLog = useServerFn(getChargeLog);
  const fetchUpcoming = useServerFn(listUpcomingCharges);
  const [range, setRange] = useState<FinanceRange>("today");
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["charge-log", range],
    queryFn: () => fetchLog({ data: { range } }),
    refetchInterval: 60_000,
  });

  const upcoming = useQuery({
    queryKey: ["upcoming-charges-compact"],
    queryFn: () => fetchUpcoming(),
    staleTime: 120_000,
  });

  const next7 = useMemo(() => {
    const rows = upcoming.data ?? [];
    const limit = Date.now() + 7 * 86_400_000;
    return rows.filter((r) => new Date(r.chargeAt).getTime() <= limit);
  }, [upcoming.data]);

  if (error)
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
        {(error as Error).message}
      </div>
    );

  const rows = (data?.rows ?? []).filter((r) => matches(r, filter));
  const t = data?.totals;

  return (
    <div className="space-y-6">
      <RangeFilter value={range} onChange={setRange} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Entrou · ${data?.label ?? "…"}`}
          value={money(t?.paidCents ?? 0)}
          tone="accent"
          hint={`${t?.paidCount ?? 0} débito(s) com sucesso · ${t?.uniqueMembers ?? 0} membro(s)`}
        />
        <StatCard
          label="Débitos falhados"
          value={t?.failedCount ?? 0}
          tone={(t?.failedCount ?? 0) > 0 ? "negative" : "default"}
          hint={`${money(t?.failedCents ?? 0)} não cobrados`}
        />
        <StatCard
          label="Taxa de sucesso"
          value={
            t?.successRate == null ? "—" : `${(t.successRate * 100).toFixed(0)}%`
          }
          hint={`${t?.attempts ?? 0} tentativa(s) · ${t?.pendingCount ?? 0} pendente(s)`}
        />
        <StatCard
          label="A cobrar nos próximos 7 dias"
          value={money(next7.reduce((s, r) => s + r.amountCents, 0))}
          hint={`${next7.length} débito(s) agendado(s)`}
        />
      </section>

      <Panel
        title={`Quem foi debitado · ${data?.label ?? ""}`}
        action={
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors",
                  filter === f.value
                    ? "bg-primary/15 text-primary ring-primary/40"
                    : "bg-surface-1 text-muted-foreground ring-border hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      >
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl border border-border bg-surface-2"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum débito neste período.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full",
                    r.status === "paid"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : r.status === "pending" || r.status === "authorized"
                        ? "bg-muted text-muted-foreground"
                        : "bg-red-500/15 text-red-400",
                  )}
                >
                  {r.status === "paid" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : r.status === "pending" || r.status === "authorized" ? (
                    <Clock className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <Link
                    to="/admin/financeiro/cliente/$userId"
                    params={{ userId: r.userId }}
                    className="block truncate text-sm font-medium hover:text-primary"
                  >
                    {who(r)}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.planName} · {dt(r.at)}
                    {r.method ? ` · ${r.method}` : ""}
                    {r.failureReason ? ` · ${r.failureReason}` : ""}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {money(
                      r.status === "paid" ? r.netCents : r.amountCents,
                      r.currency,
                    )}
                  </p>
                  <StatusBadge status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {(data?.byDay.length ?? 0) > 1 ? (
        <Panel title="Resumo por dia">
          <ul className="divide-y divide-border text-sm">
            {data!.byDay.map((d) => (
              <li key={d.day} className="flex items-center justify-between py-2">
                <span>{dayLabel(`${d.day}T12:00:00Z`)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {money(d.cents)} · {d.paid} paga(s)
                  {d.failed > 0 ? ` · ${d.failed} falhada(s)` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel
        title="Quem será debitado (próximos 7 dias)"
        action={
          <Link
            to="/admin/financeiro/debitos"
            className="text-xs text-primary hover:underline"
          >
            Ver todos
          </Link>
        }
      >
        {upcoming.isLoading ? (
          <p className="text-sm text-muted-foreground">A carregar…</p>
        ) : next7.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem débitos agendados para os próximos 7 dias.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {next7.map((r) => (
              <li
                key={r.subscriptionId}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to="/admin/financeiro/cliente/$userId"
                    params={{ userId: r.userId }}
                    className="block truncate text-sm font-medium hover:text-primary"
                  >
                    {who(r)}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.productName} · {dayLabel(r.chargeAt)}
                    {r.isFirstChargeAfterTrial ? " · 1.ª após trial" : ""}
                    {r.cancelAtPeriodEnd ? " · cancela no fim do período" : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {money(r.amountCents, r.currency)}
                  </p>
                  <StatusBadge status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
