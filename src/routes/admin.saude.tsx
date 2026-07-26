import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getBillingHealth,
  retryFailedJobs,
  runBillingTick,
} from "@/lib/ops.functions";
import type { HealthLevel } from "@/lib/ops/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/saude")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Saúde do Billing — MM Admin" },
      {
        name: "description",
        content:
          "Estado em tempo real do motor de faturação: worker, fila, webhooks, gateway e livro-razão.",
      },
      { property: "og:title", content: "Saúde do Billing — MM Admin" },
      {
        property: "og:description",
        content: "Monitorização do motor de faturação do MM Club.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: BillingHealthPage,
});

const DOT: Record<HealthLevel, string> = {
  ok: "bg-emerald-400",
  warn: "bg-amber-400",
  down: "bg-red-500",
};

function LevelIcon({ level }: { level: HealthLevel }) {
  if (level === "ok")
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (level === "warn")
    return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  return <XCircle className="h-4 w-4 text-red-500" />;
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
      {hint ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function euros(cents: number) {
  return (cents / 100).toLocaleString("pt-PT", {
    style: "currency",
    currency: "EUR",
  });
}

function BillingHealthPage() {
  const fetchHealth = useServerFn(getBillingHealth);
  const tick = useServerFn(runBillingTick);
  const retry = useServerFn(retryFailedJobs);
  const qc = useQueryClient();

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["billing-health"],
    queryFn: () => fetchHealth({ data: undefined as never }),
    refetchInterval: 30_000,
  });

  const tickMutation = useMutation({
    mutationFn: () => tick({ data: undefined as never }),
    onSuccess: (res) => {
      toast.success(
        `Tick concluído — ${res.processed} processados, ${res.failed} falhados, ${res.requeued} recuperados.`,
      );
      qc.invalidateQueries({ queryKey: ["billing-health"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const retryMutation = useMutation({
    mutationFn: () => retry({ data: undefined as never }),
    onSuccess: (res) => {
      toast.success(`${res.requeued} job(s) recolocados na fila.`);
      qc.invalidateQueries({ queryKey: ["billing-health"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Operações
          </p>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">
            Saúde do Billing
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Worker, fila, webhooks, gateway e livro-razão — atualiza a cada 30 s.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["billing-health"] })}
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={() => tickMutation.mutate()}
            disabled={tickMutation.isPending}
          >
            <Activity className="h-4 w-4" />
            Correr tick
          </Button>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {(error as Error).message}
        </div>
      ) : null}

      {isLoading || !data ? (
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-border bg-surface-1"
            />
          ))}
        </div>
      ) : (
        <>
          {/* Checks */}
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.checks.map((c) => (
              <div
                key={c.id}
                className="flex items-start gap-3 rounded-2xl border border-border bg-surface-1 p-4"
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    DOT[c.level],
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <LevelIcon level={c.level} />
                    <p className="text-sm font-medium">{c.label}</p>
                  </div>
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {c.detail}
                  </p>
                </div>
              </div>
            ))}
          </section>

          {/* Queue */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Fila</h2>
              {data.queue.failed + data.queue.dead > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => retryMutation.mutate()}
                  disabled={retryMutation.isPending}
                >
                  <RotateCcw className="h-4 w-4" />
                  Retentar falhados
                </Button>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Pendentes"
                value={data.queue.pending}
                hint={`${data.queue.due} já devidos`}
              />
              <Stat label="Em execução" value={data.queue.running} />
              <Stat
                label="Falhados"
                value={data.queue.failed + data.queue.dead}
                hint={`${data.queue.dead} mortos`}
              />
              <Stat
                label="Tempo médio"
                value={
                  data.queue.avgProcessingMs != null
                    ? `${(data.queue.avgProcessingMs / 1000).toFixed(1)} s`
                    : "—"
                }
                hint={`${data.queue.doneLast24h} concluídos em 24h`}
              />
            </div>
            {data.queue.byConsumer.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Consumidor</th>
                      <th className="px-4 py-2 text-right">Pendentes</th>
                      <th className="px-4 py-2 text-right">Falhados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.queue.byConsumer.map((c) => (
                      <tr key={c.consumer} className="border-t border-border">
                        <td className="px-4 py-2">{c.consumer}</td>
                        <td className="px-4 py-2 text-right">{c.pending}</td>
                        <td className="px-4 py-2 text-right">{c.failed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          {/* Cron + payments */}
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Último cron"
              value={
                data.cron.minutesAgo != null
                  ? `há ${data.cron.minutesAgo} min`
                  : "nunca"
              }
              hint={`${data.cron.runs} execuções · ${data.cron.durationMs ?? 0} ms`}
            />
            <Stat
              label="Pagamentos 24h"
              value={data.payments.paid24h}
              hint={`${euros(data.payments.volumeCents24h)} · ${data.payments.failed24h} falhados`}
            />
            <Stat
              label="Recuperados 24h"
              value={data.payments.recovered24h}
              hint="Dunning bem-sucedido"
            />
            <Stat
              label="Emails 24h"
              value={data.emails.sent24h}
              hint={`${data.emails.failed24h} falhados`}
            />
          </section>

          {/* Webhooks */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Webhooks</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Recebidos 24h" value={data.webhooks.last24h} />
              <Stat label="Processados" value={data.webhooks.processed24h} />
              <Stat
                label="Rejeitados / erros"
                value={data.webhooks.rejected24h + data.webhooks.errors24h}
              />
              <Stat
                label="Duração média"
                value={
                  data.webhooks.avgDurationMs != null
                    ? `${data.webhooks.avgDurationMs} ms`
                    : "—"
                }
              />
            </div>
            {data.webhooks.recent.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Quando</th>
                      <th className="px-4 py-2 text-left">Gateway</th>
                      <th className="px-4 py-2 text-left">Pagamento</th>
                      <th className="px-4 py-2 text-left">Resultado</th>
                      <th className="px-4 py-2 text-right">ms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.webhooks.recent.map((w) => (
                      <tr key={w.id} className="border-t border-border">
                        <td className="px-4 py-2 text-muted-foreground">
                          {new Date(w.receivedAt).toLocaleString("pt-PT")}
                        </td>
                        <td className="px-4 py-2">{w.gateway}</td>
                        <td className="px-4 py-2 font-mono text-xs">
                          {w.gatewayPaymentId ?? "—"}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs",
                              w.outcome === "processed"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : w.outcome === "ignored"
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-red-500/15 text-red-300",
                            )}
                          >
                            {w.outcome}
                          </span>
                          {w.error ? (
                            <span className="ml-2 text-xs text-red-300">
                              {w.error.slice(0, 80)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {w.durationMs ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum webhook registado nas últimas 24 horas.
              </p>
            )}
          </section>

          <p className="text-xs text-muted-foreground">
            Gerado em {new Date(data.generatedAt).toLocaleString("pt-PT")} ·
            gateway {data.gateway.name} ({data.gateway.environment ?? "?"}) ·
            livro-razão com {data.ledger.entries} entradas
          </p>
        </>
      )}
    </div>
  );
}
