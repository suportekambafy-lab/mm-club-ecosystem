import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Loader2, RefreshCw, Search } from "lucide-react";
import {
  day,
  money,
  Panel,
  StatCard,
  StatusBadge,
} from "@/components/admin/finance-ui";
import { listUpcomingCharges } from "@/lib/admin-finance.functions";
import type { UpcomingChargeRow } from "@/lib/admin/finance-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/financeiro/debitos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Próximos débitos — MM Admin" },
      {
        name: "description",
        content:
          "Calendário dos próximos débitos do MM Club: data, montante, plano e conta de cada cobrança agendada.",
      },
      { property: "og:title", content: "Próximos débitos — MM Admin" },
      {
        property: "og:description",
        content: "Cobranças agendadas por dia, semana e mês.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: UpcomingChargesPage,
});

const WINDOWS: { value: number | "all"; label: string }[] = [
  { value: 7, label: "7 dias" },
  { value: 15, label: "15 dias" },
  { value: 30, label: "30 dias" },
  { value: 60, label: "60 dias" },
  { value: 90, label: "90 dias" },
  { value: "all", label: "Todos" },
];

function bucketLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.round(
    (new Date(d.toDateString()).getTime() -
      new Date(now.toDateString()).getTime()) /
      86_400_000,
  );
  if (diff < 0) return "Em atraso";
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  return day(iso);
}

function UpcomingRow({ row }: { row: UpcomingChargeRow }) {
  const late = new Date(row.chargeAt).getTime() < Date.now();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <Link
          to="/admin/financeiro/cliente/$userId"
          params={{ userId: row.userId }}
          className="block truncate text-sm font-medium hover:text-primary"
        >
          {row.name ?? row.email ?? row.userId}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {row.email ?? row.userId} · {row.productName}
          {row.priceSlug ? ` · ${row.priceSlug}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {row.isFirstChargeAfterTrial ? (
          <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sky-300 ring-1 ring-sky-500/30">
            1ª após trial
          </span>
        ) : null}
        {row.cancelAtPeriodEnd ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground ring-1 ring-border">
            Cancela no fim
          </span>
        ) : null}
        <StatusBadge status={row.status} />
      </div>

      <div className="w-32 text-right">
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            late && "text-admin-accent",
          )}
        >
          {money(row.amountCents, row.currency)}
        </p>
        <p className="text-xs text-muted-foreground">{bucketLabel(row.chargeAt)}</p>
      </div>
    </div>
  );
}

function UpcomingChargesPage() {
  const run = useServerFn(listUpcomingCharges);
  const [windowDays, setWindowDays] = useState<number | "all">(30);
  const [term, setTerm] = useState("");

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["admin-upcoming-charges"],
    queryFn: () => run({}),
    staleTime: 60_000,
  });

  const rows = data ?? [];

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    const limit =
      windowDays === "all"
        ? Infinity
        : Date.now() + windowDays * 86_400_000;
    return rows.filter((r) => {
      if (new Date(r.chargeAt).getTime() > limit) return false;
      if (!q) return true;
      return (
        r.email?.toLowerCase().includes(q) ||
        r.name?.toLowerCase().includes(q) ||
        r.priceSlug.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q)
      );
    });
  }, [rows, term, windowDays]);

  const totals = useMemo(() => {
    const now = Date.now();
    const sum = (pred: (r: UpcomingChargeRow) => boolean) =>
      filtered.filter(pred).reduce((a, r) => a + r.amountCents, 0);
    const within = (days: number) => (r: UpcomingChargeRow) => {
      const t = new Date(r.chargeAt).getTime();
      return t >= now && t <= now + days * 86_400_000;
    };
    return {
      total: filtered.reduce((a, r) => a + r.amountCents, 0),
      count: filtered.length,
      next7: sum(within(7)),
      next30: sum(within(30)),
      late: sum((r) => new Date(r.chargeAt).getTime() < now),
      lateCount: filtered.filter(
        (r) => new Date(r.chargeAt).getTime() < now,
      ).length,
      trials: filtered.filter((r) => r.isFirstChargeAfterTrial).length,
    };
  }, [filtered]);

  const groups = useMemo(() => {
    const map = new Map<string, UpcomingChargeRow[]>();
    for (const r of filtered) {
      const key = r.chargeAt.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total no período"
          value={money(totals.total)}
          hint={`${totals.count} cobrança(s) agendada(s)`}
          tone="accent"
        />
        <StatCard
          label="Próximos 7 dias"
          value={money(totals.next7)}
          hint="Receita esperada"
        />
        <StatCard
          label="Próximos 30 dias"
          value={money(totals.next30)}
          hint="Receita esperada"
        />
        <StatCard
          label="Em atraso"
          value={money(totals.late)}
          hint={`${totals.lateCount} cobrança(s) por processar`}
          tone={totals.lateCount > 0 ? "negative" : "default"}
        />
      </div>

      <Panel
        title="Calendário de débitos"
        action={
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-border hover:text-foreground"
          >
            {isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Atualizar
          </button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="-mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1">
            {WINDOWS.map((w) => (
              <button
                key={String(w.value)}
                type="button"
                onClick={() => setWindowDays(w.value)}
                className={cn(
                  "shrink-0 snap-start rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors",
                  windowDays === w.value
                    ? "bg-primary/15 text-primary ring-primary/40"
                    : "bg-surface-1 text-muted-foreground ring-border hover:text-foreground",
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Email, nome ou plano…"
              className="h-9 w-full rounded-xl border border-border bg-surface-2 pl-9 pr-3 text-sm outline-none ring-primary/40 placeholder:text-muted-foreground focus:ring-2"
            />
          </div>
        </div>

        {isFetching && rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            A carregar próximos débitos…
          </p>
        ) : groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sem cobranças agendadas neste período.
          </p>
        ) : (
          <div className="space-y-4">
            {groups.map(([date, list]) => (
              <div
                key={date}
                className="overflow-hidden rounded-xl border border-border bg-surface-2"
              >
                <div className="flex items-center justify-between gap-3 bg-surface-1 px-4 py-2">
                  <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {bucketLabel(list[0].chargeAt)}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {money(list.reduce((a, r) => a + r.amountCents, 0))} ·{" "}
                    {list.length}
                  </span>
                </div>
                {list.map((r) => (
                  <UpcomingRow key={r.subscriptionId} row={r} />
                ))}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
