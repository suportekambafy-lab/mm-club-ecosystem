import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import {
  day,
  money,
  StatusBadge,
  STATUS_LABEL,
} from "@/components/admin/finance-ui";
import { listAdminSubscriptions } from "@/lib/admin-finance.functions";
import type { SubscriptionStatus } from "@/lib/billing/types";
import { cn } from "@/lib/utils";

type SearchParams = { status?: string };

export const Route = createFileRoute("/admin/financeiro/subscricoes")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    status: typeof search.status === "string" ? search.status : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Subscrições — MM Admin" },
      {
        name: "description",
        content:
          "Todas as subscrições do MM Club por estado, com acesso ao detalhe de cada membro.",
      },
      { property: "og:title", content: "Subscrições — MM Admin" },
      {
        property: "og:description",
        content: "Gestão de subscrições do MM Club.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SubscriptionsPage,
});

const FILTERS: (SubscriptionStatus | "all")[] = [
  "all",
  "active",
  "trialing",
  "past_due",
  "grace_period",
  "suspended",
  "cancelled",
  "expired",
];

function SubscriptionsPage() {
  const { status } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [term, setTerm] = useState("");
  const list = useServerFn(listAdminSubscriptions);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-subscriptions", status ?? "all"],
    queryFn: () => list({ data: { status: status ?? null } }),
  });

  const rows = (data ?? []).filter((r) => {
    const q = term.trim().toLowerCase();
    if (!q) return true;
    return (
      r.email?.toLowerCase().includes(q) ||
      r.name?.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const active = (status ?? "all") === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() =>
                navigate({
                  search: f === "all" ? {} : { status: f },
                  replace: true,
                })
              }
              className={cn(
                "rounded-full px-3 py-1.5 text-xs ring-1 transition-colors",
                active
                  ? "bg-primary text-primary-foreground ring-primary"
                  : "bg-surface-1 text-muted-foreground ring-border hover:text-foreground",
              )}
            >
              {f === "all" ? "Todas" : STATUS_LABEL[f]}
            </button>
          );
        })}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Filtrar nesta lista…"
            className="h-9 w-56 rounded-xl border border-border bg-surface-1 pl-9 pr-3 text-sm outline-none ring-primary/40 focus:ring-2"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl border border-border bg-surface-1"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface-1 p-6 text-sm text-muted-foreground">
          Nenhuma subscrição encontrada.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Membro</th>
                <th className="px-4 py-3 text-left">Plano</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">Cobranças</th>
                <th className="px-4 py-3 text-right">Total faturado</th>
                <th className="px-4 py-3 text-left">Renova</th>
                <th className="px-4 py-3 text-left">Criada</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border hover:bg-surface-1"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.email ?? r.userId}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{r.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.priceSlug}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                    {r.cancelAtPeriodEnd ? (
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-admin-muted">
                        Cancela no fim
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {money(r.amountCents, r.currency)}
                    <span className="block text-xs text-muted-foreground">
                      /{r.interval}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.chargesCount ?? 0}
                    <span className="block text-xs text-muted-foreground">
                      {r.lastPaymentAt ? day(r.lastPaymentAt) : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {money(r.lifetimeCents ?? 0, r.currency)}
                  </td>

                  <td className="px-4 py-3 text-muted-foreground">
                    {day(r.currentPeriodEnd)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {day(r.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/admin/financeiro/cliente/$userId"
                      params={{ userId: r.userId }}
                      className="text-xs text-primary hover:underline"
                    >
                      Abrir
                    </Link>
                    <ViewAsButton userId={r.userId} className="ml-2" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
