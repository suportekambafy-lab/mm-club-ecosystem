import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Loader2, MailWarning, Timer, Zap } from "lucide-react";
import { dt, money, Panel, StatCard } from "@/components/admin/finance-ui";
import {
  forceRecoveryAttempt,
  forceRecoveryAttemptAll,
  getRecoveryOverview,
  notifyFailedPayments,
  reopenStalledRecovery,
} from "@/lib/admin-finance.functions";
import type { RecoveryCustomerRow } from "@/lib/admin/recovery-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/financeiro/recovery")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Revenue Recovery — MM Admin" },
      {
        name: "description",
        content:
          "Motor de recuperação de receita do MM Club: taxa de recuperação por fase, motivos de falha, eficácia por método e dívida em aberto.",
      },
      { property: "og:title", content: "Revenue Recovery — MM Admin" },
      {
        property: "og:description",
        content:
          "Taxa de recuperação, tempo médio e worklist de cobranças falhadas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: RecoveryPage,
});

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const PHASE_LABEL: Record<string, string> = {
  immediate: "Primeiras 24 h",
  grace: "Grace period",
  suspended: "Pós-suspensão",
};


const CATEGORY_LABEL: Record<string, string> = {
  recoverable: "Recuperável",
  permanent: "Permanente",
  fraud: "Fraude",
  unknown: "Desconhecido",
};

function ScoreDot({ score }: { score: number | null }) {
  if (score === null)
    return <span className="text-xs text-muted-foreground">—</span>;
  const tone =
    score >= 70
      ? "bg-emerald-400/15 text-emerald-400"
      : score >= 40
        ? "bg-amber-400/15 text-amber-400"
        : "bg-red-400/15 text-red-400";
  return (
    <span
      className={cn(
        "inline-flex min-w-10 justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        tone,
      )}
    >
      {score}
    </span>
  );
}

function CustomerRow({
  row,
  onForce,
  busy,
}: {
  row: RecoveryCustomerRow;
  onForce: (userId: string) => void;
  busy: boolean;
}) {
  return (
    <tr className="border-t border-border/60 align-top">
      <td className="py-3 pr-3">
        <Link
          to="/admin/financeiro/cliente/$userId"
          params={{ userId: row.userId }}
          className="font-medium hover:text-primary"
        >
          {row.name}
        </Link>
        <p className="text-[11px] text-muted-foreground">
          {row.subscriptionStatus} · {row.debtAgeDays} dias em dívida
        </p>
      </td>
      <td className="py-3 pr-3">
        <ScoreDot score={row.score} />
      </td>
      <td className="py-3 pr-3 text-sm tabular-nums">
        {money(row.amountCents, row.currency)}
      </td>
      <td className="py-3 pr-3 text-sm">
        {CATEGORY_LABEL[row.category ?? "unknown"] ?? row.category}
        {row.lastFailureMessage ? (
          <p className="text-[11px] text-red-400">{row.lastFailureMessage}</p>
        ) : null}
      </td>
      <td className="py-3 pr-3 text-sm tabular-nums">
        {row.attemptsUsed}/{row.maxAttempts}
      </td>
      <td className="py-3 pr-3 text-xs text-muted-foreground">
        {row.nextAttemptAt ? dt(row.nextAttemptAt) : "—"}
      </td>
      <td className="py-3 text-right">
        <button
          type="button"
          disabled={busy}
          onClick={() => onForce(row.userId)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Zap className="h-3.5 w-3.5" />
          )}
          Tentar agora
        </button>
      </td>
    </tr>
  );
}

function RecoveryPage() {
  const load = useServerFn(getRecoveryOverview);
  const force = useServerFn(forceRecoveryAttempt);
  const notifyFailed = useServerFn(notifyFailedPayments);
  const reopen = useServerFn(reopenStalledRecovery);
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-recovery"],
    queryFn: () => load({ data: undefined }),
    staleTime: 30_000,
  });

  const forceMutation = useMutation({
    mutationFn: (userId: string) => force({ data: { userId } }),
    onMutate: (userId: string) => setPending(userId),
    onSettled: () => setPending(null),
    onSuccess: () => {
      toast.success("Tentativa de cobrança colocada em fila.");
      qc.invalidateQueries({ queryKey: ["admin-recovery"] });
    },
    onError: () => toast.error("Não foi possível iniciar a tentativa."),
  });

  const notifyMutation = useMutation({
    mutationFn: (userId?: string) => notifyFailed({ data: { userId } }),
    onSuccess: (res) =>
      toast.success(
        `Aviso enviado a ${res.notified} membro(s) com cobrança falhada.`,
      ),
    onError: () => toast.error("Não foi possível enviar os avisos."),
  });

  const reopenMutation = useMutation({
    mutationFn: () => reopen({ data: undefined }),
    onSuccess: (res) => {
      toast.success(
        res.cycles > 0
          ? `${res.cycles} ciclo(s) reabertos — ${res.attempts} tentativa(s) reagendadas até ao dia 90.`
          : "Todas as dívidas dentro dos 90 dias já estão em recuperação.",
      );
      qc.invalidateQueries({ queryKey: ["admin-recovery"] });
    },
    onError: () => toast.error("Não foi possível reabrir as recuperações."),
  });

  if (isLoading || !data)
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> A carregar métricas de
        recuperação…
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => reopenMutation.mutate()}
          disabled={reopenMutation.isPending}
          className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-surface-2 disabled:opacity-50"
        >
          {reopenMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Timer className="h-3.5 w-3.5" />
          )}
          Reabrir recuperações paradas
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Em risco agora"
          value={money(data.atRiskCents)}
          hint={`${data.customers.length} ciclos em recuperação`}
          tone="negative"
        />
        <StatCard
          label="Receita recuperada"
          value={money(data.recoveredCents)}
          hint={`Taxa global ${pct(data.recoveryRate)}`}
          tone="positive"
        />
        <StatCard
          label="Recuperado em 24h"
          value={pct(data.rateFirst24h)}
          hint={`${money(data.recoveredByWindow.h24)} nas primeiras 24 horas`}
          tone="accent"
        />
        <StatCard
          label="Tempo médio até recuperar"
          value={
            data.avgHoursToRecover === null
              ? "—"
              : `${data.avgHoursToRecover.toFixed(1)} h`
          }
          hint={`Perdido definitivamente: ${money(data.lostCents)}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Eficácia por fase" className="lg:col-span-2">
          <div className="space-y-4">
            {data.phases.map((p) => (
              <div key={p.phase} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{p.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {p.recovered}/{p.attempts} · {pct(p.rate)} ·{" "}
                    {money(p.recoveredCents)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-400/70"
                    style={{ width: `${Math.max(1, p.rate * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  <Timer className="mr-1 inline h-3 w-3" />
                  {p.avgHoursToRecover === null
                    ? "Sem recuperações nesta fase"
                    : `Média ${p.avgHoursToRecover.toFixed(1)} h até recuperar`}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Estado das subscrições">
          <dl className="space-y-2 text-sm">
            {[
              ["Em atraso", data.counts.pastDue],
              ["Grace period", data.counts.gracePeriod],
              ["Suspensas", data.counts.suspended],
              ["Canceladas", data.counts.cancelled],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 space-y-1 border-t border-border/60 pt-4 text-xs text-muted-foreground">
            <p>Recuperado ≤ 15 dias: {money(data.recoveredByWindow.d15)}</p>
            <p>Recuperado ≤ 90 dias: {money(data.recoveredByWindow.d90)}</p>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Motivos de falha">
          {data.reasons.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma cobrança falhada registada.
            </p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.reasons.slice(0, 10).map((r) => (
                  <tr key={r.code} className="border-t border-border/60">
                    <td className="py-2 pr-3">
                      <span className="block truncate">{r.label}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {CATEGORY_LABEL[r.category] ?? r.category}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {r.recovered}/{r.attempts}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Eficácia por método de pagamento">
          {data.methods.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.methods.map((m) => (
                  <tr key={m.method} className="border-t border-border/60">
                    <td className="py-2 pr-3 capitalize">{m.method}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                      {pct(m.rate)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {money(m.recoveredCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={notifyMutation.isPending}
          onClick={() => notifyMutation.mutate(undefined)}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium transition hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {notifyMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MailWarning className="h-3.5 w-3.5" />
          )}
          Avisar cartões recusados
        </button>
      </div>

      <Panel title="Recuperados">
        {data.recovered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não há cobranças recuperadas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Membro</th>
                  <th className="pb-2 pr-3 font-medium">Valor</th>
                  <th className="pb-2 pr-3 font-medium">Tentativas</th>
                  <th className="pb-2 pr-3 font-medium">Fase</th>
                  <th className="pb-2 pr-3 font-medium">Método</th>
                  <th className="pb-2 pr-3 font-medium">Tempo</th>
                  <th className="pb-2 font-medium">Recuperado em</th>
                </tr>
              </thead>
              <tbody>
                {data.recovered.map((r) => (
                  <tr key={r.cycleKey} className="border-t border-border/60">
                    <td className="py-2 pr-3">
                      <Link
                        to="/admin/financeiro/cliente/$userId"
                        params={{ userId: r.userId }}
                        className="hover:text-primary"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {money(r.amountCents)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {r.attempts}{" "}
                      <span className="text-muted-foreground">
                        {r.attempts === 1 ? "tentativa" : "tentativas"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {PHASE_LABEL[r.phase] ?? r.phase}
                    </td>
                    <td className="py-2 pr-3 capitalize text-muted-foreground">
                      {r.method ?? "—"}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                      {r.hoursToRecover === null
                        ? "—"
                        : r.hoursToRecover < 24
                          ? `${r.hoursToRecover.toFixed(1)} h`
                          : `${(r.hoursToRecover / 24).toFixed(1)} d`}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {r.recoveredAt ? dt(r.recoveredAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Dívida em aberto">

        {data.customers.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" /> Nenhuma cobrança em
            recuperação neste momento.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Membro</th>
                  <th className="pb-2 pr-3 font-medium">Score</th>
                  <th className="pb-2 pr-3 font-medium">Valor</th>
                  <th className="pb-2 pr-3 font-medium">Motivo</th>
                  <th className="pb-2 pr-3 font-medium">Tentativas</th>
                  <th className="pb-2 pr-3 font-medium">Próxima</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {data.customers.map((row) => (
                  <CustomerRow
                    key={row.cycleKey}
                    row={row}
                    busy={pending === row.userId}
                    onForce={(id) => forceMutation.mutate(id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
