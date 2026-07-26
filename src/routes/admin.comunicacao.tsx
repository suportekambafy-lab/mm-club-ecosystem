import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Eye,
  Loader2,
  Mail,
  RotateCcw,
  Save,
  Search,
  Send,
  Undo2,
} from "lucide-react";
import { dt, Panel, StatCard } from "@/components/admin/finance-ui";
import {
  getCommsOverview,
  getCommsTemplate,
  listCommsDeliveries,
  listCommsTemplates,
  previewCommsTemplate,
  resendCommsDelivery,
  resetCommsTemplate,
  saveCommsTemplate,
  sendCommsTest,
} from "@/lib/comms.functions";
import { CATEGORY_LABEL, VARIABLE_CATALOG } from "@/lib/notifications/catalog";
import type { TemplateCategory, TemplateView } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/comunicacao")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Comunicação — MM Admin" },
      {
        name: "description",
        content:
          "Motor de comunicações do MM Club: modelos de email, histórico de envios, reenvio manual e estatísticas de desempenho.",
      },
      { property: "og:title", content: "Comunicação — MM Admin" },
      {
        property: "og:description",
        content:
          "Gestão de templates transacionais, auditoria de envios e analytics de recuperação por email.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CommsPage,
});

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const STATUS_LABEL: Record<string, string> = {
  sent: "Enviado",
  skipped: "Ignorado",
  error: "Erro",
};

const REASON_LABEL: Record<string, string> = {
  duplicate_24h: "duplicado nas últimas 24h",
  invoice_paid: "fatura já paga",
  chargeback: "chargeback ativo",
  payment_pending: "pagamento pendente",
  template_inactive: "modelo desativado",
};

type Tab = "templates" | "historico" | "analytics";

function TemplateEditor({
  template,
  onClose,
}: {
  template: TemplateView;
  onClose: () => void;
}) {
  const loadOverride = useServerFn(getCommsTemplate);
  const save = useServerFn(saveCommsTemplate);
  const reset = useServerFn(resetCommsTemplate);
  const preview = useServerFn(previewCommsTemplate);
  const test = useServerFn(sendCommsTest);
  const qc = useQueryClient();

  const [subject, setSubject] = useState(template.subject);
  const [previewText, setPreviewText] = useState(template.previewText);
  const [heading, setHeading] = useState(template.heading);
  const [body, setBody] = useState(template.body.join("\n\n"));
  const [ctaLabel, setCtaLabel] = useState(template.ctaLabel ?? "");
  const [ctaUrl, setCtaUrl] = useState(template.ctaUrl ?? "");
  const [active, setActive] = useState(template.active);
  const [testTo, setTestTo] = useState("");
  const [html, setHtml] = useState<string | null>(null);

  void loadOverride;

  const refresh = () => qc.invalidateQueries({ queryKey: ["comms-templates"] });

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          key: template.key,
          subject,
          previewText,
          heading,
          bodyHtml: body,
          ctaLabel: ctaLabel || null,
          ctaUrl: ctaUrl || null,
          active,
        },
      }),
    onSuccess: () => {
      toast.success("Modelo guardado.");
      refresh();
    },
    onError: () => toast.error("Não foi possível guardar o modelo."),
  });

  const resetMutation = useMutation({
    mutationFn: () => reset({ data: { key: template.key } }),
    onSuccess: () => {
      toast.success("Modelo reposto para a versão original.");
      refresh();
      onClose();
    },
  });

  const previewMutation = useMutation({
    mutationFn: () => preview({ data: { key: template.key } }),
    onSuccess: (res) => setHtml(res.html),
    onError: () => toast.error("Não foi possível pré-visualizar."),
  });

  const testMutation = useMutation({
    mutationFn: () => test({ data: { key: template.key, to: testTo } }),
    onSuccess: () => toast.success(`Email de teste enviado para ${testTo}.`),
    onError: (e: Error) => toast.error(e.message || "Falha no envio de teste."),
  });

  const field =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">{template.name}</h3>
          <p className="text-[11px] text-muted-foreground">
            {template.key} · {CATEGORY_LABEL[template.category as TemplateCategory]} ·
            v{template.version} · {template.locale}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary hover:text-primary"
        >
          Fechar
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-xs font-medium text-muted-foreground">
            Assunto
            <input className={cn(field, "mt-1")} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Texto de pré-visualização
            <input className={cn(field, "mt-1")} value={previewText} onChange={(e) => setPreviewText(e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Título
            <input className={cn(field, "mt-1")} value={heading} onChange={(e) => setHeading(e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Corpo (parágrafos separados por linha em branco)
            <textarea
              rows={10}
              className={cn(field, "mt-1 font-mono text-xs leading-relaxed")}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-muted-foreground">
              Botão
              <input className={cn(field, "mt-1")} value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Link do botão
              <input className={cn(field, "mt-1")} value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Modelo ativo (desativado = o motor não envia este email)
          </label>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar
            </button>
            <button
              type="button"
              onClick={() => previewMutation.mutate()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs hover:border-primary hover:text-primary"
            >
              <Eye className="h-3.5 w-3.5" /> Pré-visualizar
            </button>
            {template.overridden ? (
              <button
                type="button"
                onClick={() => resetMutation.mutate()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs hover:border-primary hover:text-primary"
              >
                <Undo2 className="h-3.5 w-3.5" /> Repor original
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            <input
              type="email"
              placeholder="email@para-teste.pt"
              className={cn(field, "max-w-56")}
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
            <button
              type="button"
              disabled={!testTo || testMutation.isPending}
              onClick={() => testMutation.mutate()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs hover:border-primary hover:text-primary disabled:opacity-50"
            >
              {testMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Enviar teste
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Variáveis disponíveis
            </p>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLE_CATALOG.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  title={`${v.label} · exemplo: ${v.sample}`}
                  onClick={() => setBody((b) => `${b}{{${v.key}}}`)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 font-mono text-[10px] transition",
                    template.variables.includes(v.key)
                      ? "border-primary/50 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40",
                  )}
                >
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            {html ? (
              <iframe
                title="Pré-visualização"
                srcDoc={html}
                className="h-[520px] w-full bg-white"
                sandbox=""
              />
            ) : (
              <div className="flex h-[520px] items-center justify-center text-sm text-muted-foreground">
                Guarda e carrega em “Pré-visualizar” para veres o email final.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CommsPage() {
  const [tab, setTab] = useState<Tab>("templates");
  const [editing, setEditing] = useState<TemplateView | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const loadTemplates = useServerFn(listCommsTemplates);
  const loadLog = useServerFn(listCommsDeliveries);
  const loadStats = useServerFn(getCommsOverview);
  const resend = useServerFn(resendCommsDelivery);
  const qc = useQueryClient();

  const templates = useQuery({
    queryKey: ["comms-templates"],
    queryFn: () => loadTemplates({ data: undefined }),
    staleTime: 30_000,
  });

  const deliveries = useQuery({
    queryKey: ["comms-log", search],
    queryFn: () => loadLog({ data: { search: search || null } }),
    enabled: tab === "historico",
  });

  const stats = useQuery({
    queryKey: ["comms-stats"],
    queryFn: () => loadStats({ data: undefined }),
    enabled: tab === "analytics",
  });

  const resendMutation = useMutation({
    mutationFn: (logId: string) => resend({ data: { logId } }),
    onSuccess: () => {
      toast.success("Email reenviado.");
      qc.invalidateQueries({ queryKey: ["comms-log"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha no reenvio."),
  });

  const grouped = useMemo(() => {
    const list = (templates.data ?? []).filter(
      (t) => category === "all" || t.category === category,
    );
    const map = new Map<string, TemplateView[]>();
    for (const t of list) {
      const arr = map.get(t.category) ?? [];
      arr.push(t);
      map.set(t.category, arr);
    }
    return [...map.entries()];
  }, [templates.data, category]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Comunicação</h1>
          <p className="text-sm text-muted-foreground">
            Motor de emails transacionais do MM Club — modelos, histórico e desempenho.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-border p-1">
          {(
            [
              ["templates", "Modelos"],
              ["historico", "Histórico"],
              ["analytics", "Analytics"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                tab === id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {tab === "templates" ? (
        editing ? (
          <Panel title="Editar modelo">
            <TemplateEditor template={editing} onClose={() => setEditing(null)} />
          </Panel>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {["all", ...Object.keys(CATEGORY_LABEL)].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition",
                    category === c
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c === "all" ? "Todos" : CATEGORY_LABEL[c as TemplateCategory]}
                </button>
              ))}
            </div>

            {templates.isLoading ? (
              <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> A carregar modelos…
              </div>
            ) : (
              grouped.map(([cat, list]) => (
                <Panel key={cat} title={CATEGORY_LABEL[cat as TemplateCategory] ?? cat}>
                  <div className="grid gap-2 md:grid-cols-2">
                    {list.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setEditing(t)}
                        className="rounded-xl border border-border/70 bg-background/40 p-3 text-left transition hover:border-primary"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{t.name}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {t.sent30d} envios · 30d
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {t.subject}
                        </p>
                        <div className="mt-1.5 flex gap-1.5">
                          {t.overridden ? (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                              personalizado
                            </span>
                          ) : null}
                          {!t.active ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              inativo
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                </Panel>
              ))
            )}
          </>
        )
      ) : null}

      {tab === "historico" ? (
        <Panel
          title="Histórico de envios"
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por email do cliente"
                className="w-60 rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-xs outline-none focus:border-primary"
              />
            </div>
          }
        >
          {deliveries.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> A carregar histórico…
            </div>
          ) : (deliveries.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há envios registados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2">Data</th>
                    <th>Destinatário</th>
                    <th>Modelo</th>
                    <th>Estado</th>
                    <th className="text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {(deliveries.data ?? []).map((row) => (
                    <tr key={row.id} className="border-t border-border/60">
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{dt(row.createdAt)}</td>
                      <td className="pr-3">{row.recipient}</td>
                      <td className="pr-3">
                        <div>{row.templateName}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{row.subject}</div>
                      </td>
                      <td className="pr-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px]",
                            row.status === "sent" && "bg-emerald-400/15 text-emerald-400",
                            row.status === "skipped" && "bg-muted text-muted-foreground",
                            row.status === "error" && "bg-red-400/15 text-red-400",
                          )}
                        >
                          {STATUS_LABEL[row.status] ?? row.status}
                        </span>
                        {row.reason ? (
                          <div className="text-[11px] text-muted-foreground">
                            {REASON_LABEL[row.reason] ?? row.reason}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => resendMutation.mutate(row.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:border-primary hover:text-primary"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Reenviar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : null}

      {tab === "analytics" ? (
        stats.isLoading || !stats.data ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> A calcular métricas…
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Emails enviados (30d)" value={stats.data.sent30d} tone="accent" />
              <StatCard label="Taxa de entrega" value={pct(stats.data.deliveryRate)} tone="positive" />
              <StatCard
                label="Aberturas / cliques"
                value={`${pct(stats.data.openRate)} · ${pct(stats.data.clickRate)}`}
                hint="Registado quando o fornecedor reporta"
              />
              <StatCard
                label="Recuperação após email"
                value={pct(stats.data.recoveryAfterEmail)}
                hint="Dívida paga até 7 dias depois de um email de cobrança"
              />
            </div>

            <Panel title="Desempenho por modelo">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-2">Modelo</th>
                      <th className="text-right">Enviados</th>
                      <th className="text-right">Ignorados</th>
                      <th className="text-right">Erros</th>
                      <th className="text-right">Recuperações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.data.templates.map((t) => (
                      <tr key={t.key} className="border-t border-border/60">
                        <td className="py-2">
                          <div>{t.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {CATEGORY_LABEL[t.category as TemplateCategory] ?? t.category}
                          </div>
                        </td>
                        <td className="text-right tabular-nums">{t.sent}</td>
                        <td className="text-right tabular-nums text-muted-foreground">{t.skipped}</td>
                        <td className="text-right tabular-nums text-red-400">{t.errors}</td>
                        <td className="text-right tabular-nums text-emerald-400">{t.recovered}</td>
                      </tr>
                    ))}
                    {stats.data.templates.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-sm text-muted-foreground">
                          Sem envios nos últimos 30 dias.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Envios por categoria">
              <div className="space-y-2">
                {stats.data.byCategory.map((c) => (
                  <div key={c.category} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-primary" />
                      {CATEGORY_LABEL[c.category as TemplateCategory] ?? c.category}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{c.sent}</span>
                  </div>
                ))}
                {stats.data.byCategory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
                ) : null}
              </div>
            </Panel>
          </>
        )
      ) : null}
    </div>
  );
}
