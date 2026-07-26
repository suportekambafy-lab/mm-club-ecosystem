import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { day, dt, money, StatusBadge } from "@/components/admin/finance-ui";
import { listSubscriptionStates } from "@/lib/admin-finance.functions";
import type { SubscriptionStateRow } from "@/lib/admin/finance-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/financeiro/estado")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Estado das subscrições — MM Admin" },
      {
        name: "description",
        content:
          "Estado operacional de cada subscrição do MM Club: pagamento, próxima cobrança, webhook recebido e acessos atribuídos.",
      },
      { property: "og:title", content: "Estado das subscrições — MM Admin" },
      {
        property: "og:description",
        content:
          "Pagamentos, próxima cobrança, webhooks e entitlements por conta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SubscriptionStatePage,
});

function PaymentPill({ row }: { row: SubscriptionStateRow }) {
  const p = row.lastPayment;
  if (!p)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5" /> Sem pagamentos
      </span>
    );
  const ok = p.status === "paid";
  const bad = ["failed", "expired", "canceled", "chargeback"].includes(
    p.status,
  );
  return (
    <div className="space-y-0.5">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium",
          ok && "text-emerald-400",
          bad && "text-red-400",
          !ok && !bad && "text-muted-foreground",
        )}
      >
        {ok ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : bad ? (
          <XCircle className="h-3.5 w-3.5" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {money(p.amountCents, p.currency)} · {p.status}
      </span>
      <p className="text-[11px] text-muted-foreground">
        {dt(p.paidAt ?? p.createdAt)}
      </p>
      {p.failureReason ? (
        <p className="text-[11px] text-red-400">{p.failureReason}</p>
      ) : null}
    </div>
  );
}

function WebhookPill({ row }: { row: SubscriptionStateRow }) {
  const h = row.lastWebhook;
  if (!h)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5" /> Nenhum recebido
      </span>
    );
  const ok = h.outcome === "ok" || h.outcome === "processed";
  return (
    <div className="space-y-0.5">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium",
          ok ? "text-emerald-400" : "text-red-400",
        )}
      >
        {ok ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <XCircle className="h-3.5 w-3.5" />
        )}
        {h.gateway} · {h.outcome}
      </span>
      <p className="text-[11px] text-muted-foreground">{dt(h.receivedAt)}</p>
      {h.error ? (
        <p className="text-[11px] text-red-400">{h.error}</p>
      ) : null}
    </div>
  );
}

function SubscriptionStatePage() {
  const [term, setTerm] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const run = useServerFn(listSubscriptionStates);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-subscription-states"],
    queryFn: () => run({}),
  });

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      const hasIssue =
        !r.lastPayment ||
        r.lastPayment.status !== "paid" ||
        !r.lastWebhook ||
        r.entitlements.length === 0;
      if (onlyIssues && !hasIssue) return false;
      if (!q) return true;
      return (
        r.email?.toLowerCase().includes(q) ||
        r.name?.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (r.gatewaySubscriptionId ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, term, onlyIssues]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOnlyIssues((v) => !v)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs ring-1 transition-colors",
            onlyIssues
              ? "bg-primary text-primary-foreground ring-primary"
              : "bg-surface-1 text-muted-foreground ring-border hover:text-foreground",
          )}
        >
          Só com problemas
        </button>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-1 px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-border hover:text-foreground"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
          />
          Atualizar
        </button>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Email, nome ou ID…"
            className="h-9 w-64 rounded-xl border border-border bg-surface-1 pl-9 pr-3 text-sm outline-none ring-primary/40 focus:ring-2"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-border bg-surface-1"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface-1 p-6 text-sm text-muted-foreground">
          Nenhuma subscrição encontrada.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <article
              key={r.id}
              className="rounded-2xl border border-border bg-surface-1 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base font-semibold">
                      {r.name ?? r.email ?? r.userId}
                    </h3>
                    <StatusBadge status={r.status} />
                    {r.cancelAtPeriodEnd ? (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        cancela no fim
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.email ?? "—"} · {r.productName} · {r.priceSlug} ·{" "}
                    {money(r.amountCents, r.currency)}/{r.interval}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {r.gateway ?? "sem gateway"}
                    {r.gatewaySubscriptionId
                      ? ` · ${r.gatewaySubscriptionId}`
                      : ""}
                  </p>
                </div>
                <Link
                  to="/admin/financeiro/cliente/$userId"
                  params={{ userId: r.userId }}
                  className="text-xs text-primary hover:underline"
                >
                  Abrir cliente
                </Link>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Último pagamento
                  </p>
                  <div className="mt-1">
                    <PaymentPill row={r} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {r.paidCount} pagos · {r.failedCount} falhados
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Próxima cobrança
                  </p>
                  <p className="mt-1 text-sm tabular-nums">
                    {r.cancelAtPeriodEnd || r.status === "cancelled"
                      ? "—"
                      : day(r.currentPeriodEnd)}
                  </p>
                  {r.trialEnd ? (
                    <p className="text-[11px] text-muted-foreground">
                      Trial até {day(r.trialEnd)}
                    </p>
                  ) : null}
                </div>

                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Último webhook
                  </p>
                  <div className="mt-1">
                    <WebhookPill row={r} />
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Acessos ativos ({r.entitlements.length})
                  </p>
                  {r.entitlements.length === 0 ? (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-red-400">
                      <AlertTriangle className="h-3.5 w-3.5" /> Sem
                      entitlements
                    </p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.entitlements.map((e) => (
                        <span
                          key={`${e.featureKey}-${e.source}`}
                          title={`${e.source}${
                            e.expiresAt ? ` · expira ${day(e.expiresAt)}` : ""
                          }`}
                          className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted-foreground ring-1 ring-border"
                        >
                          <ShieldCheck className="h-3 w-3 text-emerald-400" />
                          {e.featureKey}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
