import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  day,
  dt,
  money,
  Panel,
  StatCard,
  StatusBadge,
} from "@/components/admin/finance-ui";
import {
  adminCancelSubscription,
  adminResumeSubscription,
  getCustomerDetail,
} from "@/lib/admin-finance.functions";
import type { CustomerDetail } from "@/lib/admin/finance-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/financeiro/cliente/$userId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cliente 360 — MM Admin" },
      {
        name: "description",
        content:
          "Timeline, ledger, pagamentos, faturas e eventos de um membro do MM Club.",
      },
      { property: "og:title", content: "Cliente 360 — MM Admin" },
      {
        property: "og:description",
        content: "Detalhe completo de faturação de um membro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CustomerPage,
});

const TABS = [
  "timeline",
  "subscricoes",
  "pagamentos",
  "faturas",
  "ledger",
  "eventos",
] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  timeline: "Timeline",
  subscricoes: "Subscrições",
  pagamentos: "Pagamentos",
  faturas: "Faturas",
  ledger: "Ledger",
  eventos: "Eventos",
};

function CustomerPage() {
  const { userId } = Route.useParams();
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getCustomerDetail);
  const cancelFn = useServerFn(adminCancelSubscription);
  const resumeFn = useServerFn(adminResumeSubscription);
  const [tab, setTab] = useState<Tab>("timeline");
  const [asCustomer, setAsCustomer] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-customer", userId],
    queryFn: () => fetchDetail({ data: { userId } }),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin-customer", userId] });

  const cancelMutation = useMutation({
    mutationFn: (i: { subscriptionId: string; immediate: boolean }) =>
      cancelFn({
        data: {
          subscriptionId: i.subscriptionId,
          userId,
          immediate: i.immediate,
          reason: "admin_backoffice",
        },
      }),
    onSuccess: () => {
      toast.success("Subscrição atualizada.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resumeMutation = useMutation({
    mutationFn: (subscriptionId: string) =>
      resumeFn({ data: { subscriptionId, userId } }),
    onSuccess: () => {
      toast.success("Subscrição reativada.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (error)
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
        {(error as Error).message}
      </div>
    );

  if (isLoading || !data)
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl border border-border bg-surface-1"
          />
        ))}
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/admin/financeiro/subscricoes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <div className="ml-auto">
          <Button size="sm" variant="outline" onClick={() => setAsCustomer(true)}>
            <Eye className="h-4 w-4" />
            Ver como o cliente
          </Button>
        </div>
      </div>

      <header className="rounded-2xl border border-border bg-surface-1 p-5">
        <h1 className="text-xl font-semibold">{data.name ?? "Membro"}</h1>
        <p className="text-sm text-muted-foreground">{data.email ?? userId}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Cliente desde {day(data.createdAt)}
          {data.country ? ` · ${data.country}` : ""}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total pago" value={money(data.lifetimeCents)} tone="accent" />
          <StatCard label="Saldo em conta" value={money(data.balanceCents)} />
          <StatCard label="Créditos Studio" value={data.credits ?? 0} />
          <StatCard
            label="Subscrições"
            value={data.subscriptions.length}
            hint={`${data.features.length} funcionalidade(s) ativa(s)`}
          />
        </div>
        {data.features.length ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {data.features.map((f) => (
              <span
                key={f}
                className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-muted-foreground ring-1 ring-border"
              >
                {f}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      {data.paymentMethods.length ? (
        <Panel title="Métodos de pagamento">
          <ul className="space-y-2 text-sm">
            {data.paymentMethods.map((m) => (
              <li key={m.id} className="flex items-center justify-between">
                <span>
                  {m.brand ?? m.method ?? m.gateway}
                  {m.last4 ? ` •••• ${m.last4}` : ""}
                  {m.expMonth && m.expYear
                    ? ` · ${String(m.expMonth).padStart(2, "0")}/${m.expYear}`
                    : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {m.isDefault ? "Predefinido · " : ""}
                  {m.status}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs ring-1 transition-colors",
              tab === t
                ? "bg-primary text-primary-foreground ring-primary"
                : "bg-surface-1 text-muted-foreground ring-border hover:text-foreground",
            )}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === "timeline" ? (
        <Panel title="Timeline">
          {data.timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem eventos.</p>
          ) : (
            <ol className="space-y-4 border-l border-border pl-5">
              {data.timeline.map((t) => (
                <li key={t.id} className="relative">
                  <span className="absolute -left-[23px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                  <p className="text-sm font-medium">{t.title}</p>
                  {t.description ? (
                    <p className="text-xs text-muted-foreground">
                      {t.description}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    {dt(t.occurredAt)}
                    {t.amountCents != null
                      ? ` · ${money(t.amountCents, t.currency ?? "EUR")}`
                      : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      ) : null}

      {tab === "subscricoes" ? (
        <Panel title="Subscrições">
          {data.subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem subscrições.</p>
          ) : (
            <ul className="space-y-3">
              {data.subscriptions.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {s.productName}{" "}
                      <span className="text-xs text-muted-foreground">
                        {s.priceSlug}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {money(s.amountCents, s.currency)}/{s.interval} · renova{" "}
                      {day(s.currentPeriodEnd)}
                      {s.trialEnd ? ` · trial até ${day(s.trialEnd)}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                  {s.cancelAtPeriodEnd ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resumeMutation.mutate(s.id)}
                      disabled={resumeMutation.isPending}
                    >
                      Reativar
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          cancelMutation.mutate({
                            subscriptionId: s.id,
                            immediate: false,
                          })
                        }
                        disabled={cancelMutation.isPending}
                      >
                        Cancelar no fim
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          cancelMutation.mutate({
                            subscriptionId: s.id,
                            immediate: true,
                          })
                        }
                        disabled={cancelMutation.isPending}
                      >
                        Cancelar já
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      {tab === "pagamentos" ? (
        <Panel title="Pagamentos">
          {data.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem pagamentos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2 text-left">Data</th>
                    <th className="py-2 text-left">Gateway</th>
                    <th className="py-2 text-left">Estado</th>
                    <th className="py-2 text-right">Valor</th>
                    <th className="py-2 text-right">Reembolsado</th>
                    <th className="py-2 text-left">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="py-2">{dt(p.paidAt ?? p.createdAt)}</td>
                      <td className="py-2 text-muted-foreground">
                        {p.gateway}
                        <span className="block text-[11px]">{p.method ?? "—"}</span>
                      </td>
                      <td className="py-2">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {money(p.amountCents, p.currency)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {p.refundedCents
                          ? money(p.refundedCents, p.currency)
                          : "—"}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {p.failureReason ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : null}

      {tab === "faturas" ? (
        <Panel title="Faturas">
          {data.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem faturas.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {data.invoices.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2">
                  <span className="font-mono text-xs">{i.number ?? i.id.slice(0, 8)}</span>
                  <StatusBadge status={i.status} />
                  <span className="ml-auto tabular-nums">
                    {money(i.totalCents, i.currency)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {day(i.paidAt ?? i.issuedAt)}
                  </span>
                  {i.pdfUrl ? (
                    <a
                      href={i.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      PDF
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      {tab === "ledger" ? (
        <Panel title="Ledger (append-only)">
          {data.ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem movimentos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2 text-left">Data</th>
                    <th className="py-2 text-left">Tipo</th>
                    <th className="py-2 text-left">Direção</th>
                    <th className="py-2 text-right">Valor</th>
                    <th className="py-2 text-right">Créditos</th>
                    <th className="py-2 text-left">Memo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ledger.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="py-2">{dt(l.createdAt)}</td>
                      <td className="py-2">{l.entryType}</td>
                      <td
                        className={cn(
                          "py-2",
                          l.direction === "credit"
                            ? "text-emerald-300"
                            : "text-muted-foreground",
                        )}
                      >
                        {l.direction}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {money(l.amountCents, l.currency)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {l.creditsDelta || "—"}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {l.memo ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : null}

      {tab === "eventos" ? (
        <Panel title="Eventos de domínio">
          {data.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem eventos.</p>
          ) : (
            <ul className="space-y-2">
              {data.events.map((e) => (
                <li
                  key={e.id}
                  className="rounded-xl border border-border bg-surface-2 p-3"
                >
                  <p className="text-sm font-medium">{e.type}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {e.aggregateType} · {dt(e.occurredAt)}
                  </p>
                  <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-background/60 p-2 text-[11px] text-muted-foreground">
                    {e.payloadJson}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      {asCustomer ? (
        <CustomerViewModal data={data} onClose={() => setAsCustomer(false)} />
      ) : null}
    </div>
  );
}

function CustomerViewModal({
  data,
  onClose,
}: {
  data: CustomerDetail;
  onClose: () => void;
}) {
  const active = data.subscriptions.find(
    (s) => s.status === "active" || s.status === "trialing",
  );
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 p-4 backdrop-blur">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface-1 p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Ver como o cliente
            </p>
            <h2 className="text-lg font-semibold">{data.name ?? "Membro"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <p className="text-xs text-muted-foreground">O teu plano</p>
            <p className="mt-1 text-base font-medium">
              {active ? active.productName : "Sem plano ativo"}
            </p>
            {active ? (
              <p className="text-xs text-muted-foreground">
                {money(active.amountCents, active.currency)}/{active.interval} ·{" "}
                {active.cancelAtPeriodEnd
                  ? `termina a ${day(active.currentPeriodEnd)}`
                  : `renova a ${day(active.currentPeriodEnd)}`}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <p className="text-xs text-muted-foreground">Créditos MM Studio</p>
            <p className="mt-1 text-base font-medium">{data.credits ?? 0}</p>
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <p className="mb-2 text-xs text-muted-foreground">Acessos ativos</p>
            {data.features.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sem funcionalidades ativas.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {data.features.map((f) => (
                  <span
                    key={f}
                    className="rounded-full bg-background/60 px-2.5 py-1 text-[11px] ring-1 ring-border"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <p className="mb-2 text-xs text-muted-foreground">
              Histórico de faturação
            </p>
            {data.invoices.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem faturas.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {data.invoices.slice(0, 5).map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <span>{day(i.paidAt ?? i.issuedAt)}</span>
                    <span className="tabular-nums">
                      {money(i.totalCents, i.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground">
          Vista só de leitura — reflete exatamente o que este membro vê no
          perfil dele.
        </p>
      </div>
    </div>
  );
}
