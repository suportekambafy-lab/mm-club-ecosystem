import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  AlertTriangle,
  Ban,
  Eye,
  Fingerprint,
  Gauge,
  Lock,
  RefreshCw,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getSecurityOverview,
  getSecurityScore,
  runSecurityScanNow,
  setEmergencyMode,
  setReadOnlyMode,
} from "@/lib/security.functions";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/admin/seguranca")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Segurança — MM Admin" },
      {
        name: "description",
        content:
          "Monitorização Zero Trust: eventos de segurança, bloqueios, auditoria de admin e modo de emergência.",
      },
      { property: "og:title", content: "Segurança — MM Admin" },
      {
        property: "og:description",
        content: "Painel de segurança e resposta a incidentes do MM Club.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SecurityPage,
});

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warn" | "bad";
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold",
          tone === "warn" && "text-admin-accent",
          tone === "bad" && "text-red-500",
        )}
      >
        {value}
      </p>
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  auth_denied: "Sessão inválida",
  authz_denied: "Acesso admin negado",
  entitlement_denied: "Sem permissão",
  rate_limited: "Limite excedido",
  waf_blocked: "Comportamento suspeito",
  emergency_block: "Bloqueado (emergência)",
  emergency_enabled: "Emergência ligada",
  emergency_disabled: "Emergência desligada",
  login_failed: "Login falhado",
  admin_access: "Acesso admin",
  upload_rejected: "Upload rejeitado",
  webhook_rejected: "Webhook rejeitado",
};

function fmt(ts: string) {
  return new Date(ts).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SecurityPage() {
  const qc = useQueryClient();
  const fetchOverview = useServerFn(getSecurityOverview);
  const toggleEmergency = useServerFn(setEmergencyMode);
  const [reason, setReason] = useState("");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["security-overview"],
    queryFn: () => fetchOverview(),
    refetchInterval: 30_000,
  });

  const emergency = useMutation({
    mutationFn: (enabled: boolean) =>
      toggleEmergency({ data: { enabled, reason: reason.trim() || null } }),
    onSuccess: (res) => {
      toast.success(
        res.enabled
          ? "Modo de emergência ativado — operações sensíveis bloqueadas."
          : "Modo de emergência desativado.",
      );
      void qc.invalidateQueries({ queryKey: ["security-overview"] });
    },
    onError: () => toast.error("Não foi possível alterar o modo de emergência."),
  });

  const fetchScore = useServerFn(getSecurityScore);
  const runScan = useServerFn(runSecurityScanNow);
  const toggleReadOnly = useServerFn(setReadOnlyMode);

  const scoreQuery = useQuery({
    queryKey: ["security-score"],
    queryFn: () => fetchScore(),
    refetchInterval: 300_000,
  });

  const scan = useMutation({
    mutationFn: () => runScan(),
    onSuccess: () => {
      toast.success("Verificação de segurança concluída.");
      void qc.invalidateQueries({ queryKey: ["security-score"] });
      void qc.invalidateQueries({ queryKey: ["security-overview"] });
    },
    onError: () => toast.error("Não foi possível correr a verificação."),
  });

  const readOnly = useMutation({
    mutationFn: (enabled: boolean) =>
      toggleReadOnly({ data: { enabled, reason: reason.trim() || null } }),
    onSuccess: (res) => {
      toast.success(
        res.enabled
          ? "Modo apenas-leitura ativado — escritas bloqueadas."
          : "Modo apenas-leitura desativado.",
      );
      void qc.invalidateQueries({ queryKey: ["security-overview"] });
    },
    onError: () => toast.error("Não foi possível alterar o modo apenas-leitura."),
  });

  const on = data?.emergency.enabled ?? false;
  const ro = data?.readOnly.enabled ?? false;
  const report = scoreQuery.data;


  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ShieldCheck className="h-6 w-6 text-admin-accent" />
            Segurança
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tudo o que é sensível é validado no servidor. Aqui vê o que foi
            tentado, o que foi bloqueado e quem mexeu em quê.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["security-overview"] })}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
          Atualizar
        </Button>
      </header>

      {/* Kill switch */}
      <section
        className={cn(
          "rounded-2xl border p-5",
          on ? "border-red-500/60 bg-red-500/10" : "border-border bg-surface-1",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Siren className={cn("h-5 w-5", on ? "text-red-500" : "text-muted-foreground")} />
            <div>
              <p className="font-medium">
                Modo de emergência {on ? "ATIVO" : "desligado"}
              </p>
              <p className="text-sm text-muted-foreground">
                Bloqueia checkouts, novos métodos de pagamento e uploads. Leitura
                e login continuam a funcionar.
              </p>
              {on && data?.emergency.reason ? (
                <p className="mt-1 text-sm text-red-400">
                  Motivo: {data.emergency.reason}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!on ? (
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo (opcional)"
                maxLength={300}
                className="h-9 w-56 rounded-lg border border-border bg-background px-3 text-sm"
              />
            ) : null}
            <Button
              variant={on ? "outline" : "destructive"}
              disabled={emergency.isPending}
              onClick={() => emergency.mutate(!on)}
            >
              {on ? "Desativar" : "Ativar modo de emergência"}
            </Button>
          </div>
        </div>
      </section>

      {/* Alerts */}
      {data?.alerts.length ? (
        <section className="space-y-2">
          {data.alerts.map((a) => (
            <div
              key={a.id}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4",
                a.level === "critical"
                  ? "border-red-500/50 bg-red-500/10"
                  : "border-admin-accent/40 bg-admin-accent/10",
              )}
            >
              <AlertTriangle
                className={cn(
                  "mt-0.5 h-4 w-4",
                  a.level === "critical" ? "text-red-500" : "text-admin-accent",
                )}
              />
              <div>
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-sm text-muted-foreground">{a.detail}</p>
              </div>
            </div>
          ))}
        </section>
      ) : !isLoading ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">
          Sem alertas nas últimas 24 horas.
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pedidos bloqueados (24h)" value={data?.blocked24h ?? "—"} tone={(data?.blocked24h ?? 0) > 0 ? "warn" : "default"} />
        <Stat label="Logins falhados (24h)" value={data?.failedLogins24h ?? "—"} tone={(data?.failedLogins24h ?? 0) >= 20 ? "bad" : "default"} />
        <Stat label="Acessos admin (24h)" value={data?.adminAccess24h ?? "—"} />
        <Stat label="Falhas de webhook (24h)" value={data?.webhookFailures24h ?? "—"} tone={(data?.webhookFailures24h ?? 0) > 0 ? "bad" : "default"} />
      </section>

      {data?.topIps.length ? (
        <section className="rounded-2xl border border-border bg-surface-1 p-5">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Ban className="h-4 w-4 text-admin-accent" /> IPs com mais bloqueios (24h)
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            {data.topIps.map((i) => (
              <li key={i.ip} className="flex justify-between font-mono text-xs">
                <span>{i.ip}</span>
                <span className="text-muted-foreground">{i.count}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Events */}
      <section className="rounded-2xl border border-border bg-surface-1">
        <h2 className="flex items-center gap-2 border-b border-border p-5 text-sm font-medium">
          <ShieldAlert className="h-4 w-4 text-admin-accent" /> Eventos de segurança
        </h2>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface-1 text-muted-foreground">
              <tr>
                <th className="p-3 font-normal">Quando</th>
                <th className="p-3 font-normal">Evento</th>
                <th className="p-3 font-normal">Rota</th>
                <th className="p-3 font-normal">IP</th>
                <th className="p-3 font-normal">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {(data?.events ?? []).map((e) => (
                <tr key={e.id} className="border-t border-border/60">
                  <td className="whitespace-nowrap p-3 text-muted-foreground">{fmt(e.createdAt)}</td>
                  <td className="p-3">
                    <span
                      className={cn(
                        e.severity === "critical" && "text-red-500",
                        e.severity === "warn" && "text-admin-accent",
                      )}
                    >
                      {KIND_LABEL[e.kind] ?? e.kind}
                    </span>
                    {e.reason ? (
                      <span className="block text-muted-foreground">{e.reason}</span>
                    ) : null}
                  </td>
                  <td className="p-3 font-mono text-muted-foreground">{e.route ?? "—"}</td>
                  <td className="p-3 font-mono text-muted-foreground">{e.ip ?? "—"}</td>
                  <td className="p-3">{e.outcome === "blocked" ? "Bloqueado" : "Permitido"}</td>
                </tr>
              ))}
              {!isLoading && !data?.events.length ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    Sem eventos registados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* Admin audit */}
      <section className="rounded-2xl border border-border bg-surface-1">
        <h2 className="flex items-center gap-2 border-b border-border p-5 text-sm font-medium">
          <Fingerprint className="h-4 w-4 text-admin-accent" /> Auditoria de administração
        </h2>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface-1 text-muted-foreground">
              <tr>
                <th className="p-3 font-normal">Quando</th>
                <th className="p-3 font-normal">Quem</th>
                <th className="p-3 font-normal">Ação</th>
                <th className="p-3 font-normal">Alvo</th>
                <th className="p-3 font-normal">Origem</th>
              </tr>
            </thead>
            <tbody>
              {(data?.adminActions ?? []).map((a) => (
                <tr key={a.id} className="border-t border-border/60">
                  <td className="whitespace-nowrap p-3 text-muted-foreground">{fmt(a.createdAt)}</td>
                  <td className="p-3">{a.actorEmail ?? "—"}</td>
                  <td className="p-3 font-mono">{a.action}</td>
                  <td className="p-3 font-mono text-muted-foreground">
                    {a.entityType}
                    {a.entityId ? `:${a.entityId.slice(0, 8)}` : ""}
                  </td>
                  <td className="p-3 font-mono text-muted-foreground">
                    {a.ip ?? "—"}
                    {a.geo ? ` · ${a.geo}` : ""}
                  </td>
                </tr>
              ))}
              {!isLoading && !data?.adminActions.length ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    Sem ações registadas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-1 p-5 text-sm">
        <h2 className="flex items-center gap-2 font-medium">
          <Eye className="h-4 w-4 text-admin-accent" /> Resposta a incidentes
        </h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Ativar o modo de emergência (bloqueia pagamentos e uploads).</li>
          <li>Identificar o IP ou conta na tabela de eventos acima.</li>
          <li>Revogar acessos da conta afetada em Financeiro → Estado &amp; acessos.</li>
          <li>Confirmar na auditoria se houve alterações de administração indevidas.</li>
          <li>Repor o serviço e desativar o modo de emergência.</li>
        </ol>
      </section>
    </div>
  );
}
