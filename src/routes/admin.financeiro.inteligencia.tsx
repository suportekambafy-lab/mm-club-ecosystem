import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Brain, Loader2, RefreshCw, ShieldAlert, TrendingUp } from "lucide-react";
import { dt, money, Panel, StatCard } from "@/components/admin/finance-ui";
import {
  getIntelligenceOverview,
  rescoreMember,
} from "@/lib/admin-finance.functions";
import type { IntelligenceCustomer } from "@/lib/admin/intelligence-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/financeiro/inteligencia")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Revenue Intelligence — MM Admin" },
      {
        name: "description",
        content:
          "Motor de decisão do MM Club: Recovery Score dinâmico, perfis de pagamento, eficácia do algoritmo e explicabilidade de cada decisão.",
      },
      { property: "og:title", content: "Revenue Intelligence — MM Admin" },
      {
        property: "og:description",
        content:
          "Score médio, clientes com maior probabilidade de recuperação e fatores que influenciam a decisão.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: IntelligencePage,
});

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const STRATEGY_LABEL: Record<string, string> = {
  aggressive: "Agressiva",
  balanced: "Equilibrada",
  conservative: "Conservadora",
  communicate: "Comunicação",
};

function ScorePill({ score }: { score: number | null }) {
  const s = score ?? 0;
  const tone =
    s >= 70
      ? "bg-emerald-400/15 text-emerald-400"
      : s >= 40
        ? "bg-amber-400/15 text-amber-400"
        : "bg-red-400/15 text-red-400";
  return (
    <span
      className={cn(
        "inline-flex min-w-11 justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        tone,
      )}
    >
      {score ?? "—"}
    </span>
  );
}

function CustomerCard({
  row,
  onRescore,
  busy,
}: {
  row: IntelligenceCustomer;
  onRescore: (userId: string) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border/70 bg-background/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/admin/financeiro/cliente/$userId"
            params={{ userId: row.userId }}
            className="font-medium hover:text-primary"
          >
            {row.name}
          </Link>
          <p className="text-[11px] text-muted-foreground">
            {Math.round(row.monthsAsCustomer)} meses · {row.consecutiveSuccesses}{" "}
            pagamentos seguidos · recuperação histórica {pct(row.recoveryRate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ScorePill score={row.score} />
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            {STRATEGY_LABEL[row.strategy ?? ""] ?? "—"}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => onRescore(row.userId)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Recalcular
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>Dívida {money(row.amountCents, row.currency)}</span>
        <span>Próxima tentativa {dt(row.nextAttemptAt)}</span>
        {row.typicalPayDay ? <span>Costuma pagar no dia {row.typicalPayDay}</span> : null}
        {row.bestPayHour != null ? <span>Melhor hora {row.bestPayHour}h</span> : null}
        {row.preferredMethod ? <span>Método {row.preferredMethod}</span> : null}
      </div>

      <p className="mt-2 text-xs text-foreground/80">{row.reason}</p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 text-[11px] font-medium text-primary hover:underline"
      >
        {open ? "Ocultar explicação" : "Porquê este score?"}
      </button>
      {open ? (
        <ul className="mt-2 space-y-1 border-t border-border/60 pt-2 text-xs">
          {row.factors.length === 0 ? (
            <li className="text-muted-foreground">Sem fatores registados.</li>
          ) : (
            row.factors.map((f) => (
              <li key={f.key} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{f.label}</span>
                <span
                  className={cn(
                    "shrink-0 tabular-nums font-medium",
                    f.points >= 0 ? "text-emerald-400" : "text-red-400",
                  )}
                >
                  {f.points > 0 ? `+${f.points}` : f.points}
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

function IntelligencePage() {
  const load = useServerFn(getIntelligenceOverview);
  const rescore = useServerFn(rescoreMember);
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-intelligence"],
    queryFn: () => load({ data: undefined }),
    staleTime: 30_000,
  });

  const rescoreMutation = useMutation({
    mutationFn: (userId: string) => rescore({ data: { userId } }),
    onMutate: (userId: string) => setPending(userId),
    onSettled: () => setPending(null),
    onSuccess: () => {
      toast.success("Perfil atualizado e score recalculado.");
      qc.invalidateQueries({ queryKey: ["admin-intelligence"] });
    },
    onError: () => toast.error("Não foi possível recalcular o score."),
  });

  if (isLoading || !data)
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> A carregar o motor de
        decisão…
      </div>
    );

  const maxTrend = Math.max(...data.scoreTrend.map((p) => p.avgScore), 100);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Recovery Score médio"
          value={data.avgScore}
          hint={`${data.profiles} perfis de pagamento`}
          tone="accent"
        />
        <StatCard
          label="Acerto em score alto"
          value={pct(data.precisionHigh)}
          hint="Ciclos previstos como recuperáveis que recuperaram"
          tone="positive"
        />
        <StatCard
          label="Acerto em score baixo"
          value={pct(data.precisionLow)}
          hint="Ciclos previstos como perdidos que não recuperaram"
        />
        <StatCard
          label="Tempo médio até recuperar"
          value={
            data.avgHoursToRecover === null
              ? "—"
              : `${data.avgHoursToRecover.toFixed(1)} h`
          }
          hint="Da falha inicial ao pagamento"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Evolução do Recovery Score" className="lg:col-span-2">
          {data.scoreTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não existem scores calculados.
            </p>
          ) : (
            <div className="flex h-40 items-end gap-1">
              {data.scoreTrend.map((p) => (
                <div
                  key={p.date}
                  title={`${p.date} · média ${p.avgScore} (${p.samples})`}
                  className="flex-1 rounded-t bg-primary/60"
                  style={{ height: `${Math.max(3, (p.avgScore / maxTrend) * 100)}%` }}
                />
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            <TrendingUp className="mr-1 inline h-3 w-3" />
            Média diária do score atribuído a cada tentativa.
          </p>
        </Panel>

        <Panel title="Recuperação por perfil de cliente">
          {data.segments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <div className="space-y-3">
              {data.segments.map((s) => (
                <div key={s.key} className="space-y-1">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate">{s.label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {pct(s.rate)} · score {s.avgScore}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-400/70"
                      style={{ width: `${Math.max(2, s.rate * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Principais fatores que influenciam o score">
        {data.factors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não existem decisões registadas.
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {data.factors.map((f) => (
                <tr key={f.key} className="border-t border-border/60">
                  <td className="py-2 pr-3">{f.label}</td>
                  <td className="py-2 pr-3 text-right text-[11px] text-muted-foreground">
                    {f.occurrences}×
                  </td>
                  <td
                    className={cn(
                      "py-2 text-right tabular-nums font-medium",
                      f.avgPoints >= 0 ? "text-emerald-400" : "text-red-400",
                    )}
                  >
                    {f.avgPoints > 0 ? `+${f.avgPoints}` : f.avgPoints}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Maior probabilidade de recuperação"
          action={<Brain className="h-4 w-4 text-primary" />}
        >
          <div className="space-y-3">
            {data.mostLikely.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma dívida em aberto.
              </p>
            ) : (
              data.mostLikely.map((row) => (
                <CustomerCard
                  key={`${row.userId}-likely`}
                  row={row}
                  busy={pending === row.userId}
                  onRescore={(id) => rescoreMutation.mutate(id)}
                />
              ))
            )}
          </div>
        </Panel>

        <Panel
          title="Clientes de alto risco"
          action={<ShieldAlert className="h-4 w-4 text-red-400" />}
        >
          <div className="space-y-3">
            {data.highRisk.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma dívida em aberto.
              </p>
            ) : (
              data.highRisk.map((row) => (
                <CustomerCard
                  key={`${row.userId}-risk`}
                  row={row}
                  busy={pending === row.userId}
                  onRescore={(id) => rescoreMutation.mutate(id)}
                />
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
