import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpRight,
  Coins,
  Gift,
  Handshake,
  Loader2,
  MousePointerClick,
  Users,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCreditPurchases,
  getPartnerLinkStats,
  savePartnerConversion,
} from "@/lib/partner-links.functions";
import {
  decidePartnerPayout,
  getPartnersOverview,
} from "@/lib/partners-admin.functions";
import { MemberAvatar } from "@/components/mm/member-avatar";

export const Route = createFileRoute("/admin/parcerias")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Parcerias & Créditos — MM Admin" },
      {
        name: "description",
        content:
          "Quantos membros abriram o convite Shopify, quantos clicaram por módulo e quem comprou créditos MM Studio.",
      },
      { property: "og:title", content: "Parcerias & Créditos — MM Admin" },
      {
        property: "og:description",
        content: "Cliques no convite Shopify por módulo e compras de créditos MM Studio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PartnersPage,
});

function money(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
}

function when(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PLACEMENT_LABEL: Record<string, string> = {
  dashboard: "Painel",
  "lesson-start": "Início da aula",
  "lesson-end": "Fim da aula",
  shorts: "MM Shorts",
};

function Card({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-xl bg-admin-panel p-4">
      <div className="flex items-center gap-2 text-[12px] text-admin-muted">
        <Icon strokeWidth={1.6} className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold text-admin-fg">{value}</p>
      {hint ? <p className="mt-1 text-[12px] text-admin-faint">{hint}</p> : null}
    </div>
  );
}

function PartnersPage() {
  const [tab, setTab] = useState<"shopify" | "creditos" | "mmpartners">("shopify");
  const statsFn = useServerFn(getPartnerLinkStats);
  const creditsFn = useServerFn(getCreditPurchases);
  const saveFn = useServerFn(savePartnerConversion);
  const qc = useQueryClient();

  const stats = useQuery({ queryKey: ["admin", "partner-links"], queryFn: () => statsFn({}) });
  const credits = useQuery({
    queryKey: ["admin", "credit-purchases"],
    queryFn: () => creditsFn({}),
    enabled: tab === "creditos",
  });

  const save = useMutation({
    mutationFn: (input: {
      moduleKey: string;
      moduleLabel: string;
      paidCount: number;
      revenueCents: number;
    }) => saveFn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "partner-links"] }),
  });

  const [drafts, setDrafts] = useState<Record<string, { paid: string; revenue: string }>>({});

  const totals = stats.data?.totals;
  const ctr = useMemo(() => {
    if (!totals || totals.impressions === 0) return "0%";
    return `${((totals.clicks / totals.impressions) * 100).toFixed(1)}%`;
  }, [totals]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold text-admin-fg">Parcerias & Créditos</h1>
        <p className="mt-1 text-[13px] text-admin-muted">
          Cliques no convite Shopify por módulo e compras de créditos do MM Studio.
        </p>
      </header>

      <div className="flex gap-1 rounded-xl bg-admin-panel p-1 text-[13px]">
        {(
          [
            ["shopify", "Convite Shopify"],
            ["creditos", "Compras de créditos"],
            ["mmpartners", "MM Partners"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              tab === key
                ? "flex-1 rounded-lg bg-admin-hover px-3 py-2 font-medium text-admin-fg"
                : "flex-1 rounded-lg px-3 py-2 text-admin-muted transition hover:text-admin-fg"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "shopify" ? (
        stats.isLoading ? (
          <div className="flex items-center gap-2 p-6 text-[13px] text-admin-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
          </div>
        ) : stats.isError ? (
          <p className="p-6 text-[13px] text-admin-muted">Não foi possível carregar os dados.</p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card
                label="Convites mostrados"
                value={String(totals?.impressions ?? 0)}
                icon={ArrowUpRight}
              />
              <Card
                label="Cliques no link"
                value={String(totals?.clicks ?? 0)}
                hint={`Taxa de clique ${ctr}`}
                icon={MousePointerClick}
              />
              <Card
                label="Membros diferentes"
                value={String(totals?.uniqueClickers ?? 0)}
                hint="Pessoas que abriram o link"
                icon={Users}
              />
              <Card
                label="Contas pagas"
                value={String(totals?.paidCount ?? 0)}
                hint={
                  totals?.revenueCents
                    ? `Comissão registada ${money(totals.revenueCents)}`
                    : "Valores do painel de afiliado"
                }
                icon={Coins}
              />
            </div>

            <section className="rounded-xl bg-admin-panel">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <h2 className="text-[14px] font-medium text-admin-fg">Por módulo</h2>
                <p className="text-[12px] text-admin-faint">
                  O Shopify não devolve as contas pagas — escreve o número do painel de afiliado e
                  guarda.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-[13px]">
                  <thead className="text-left text-[12px] text-admin-faint">
                    <tr className="border-t border-admin-border">
                      <th className="px-4 py-2 font-normal">Módulo</th>
                      <th className="px-4 py-2 font-normal">Mostrado</th>
                      <th className="px-4 py-2 font-normal">Cliques</th>
                      <th className="px-4 py-2 font-normal">Membros</th>
                      <th className="px-4 py-2 font-normal">Taxa</th>
                      <th className="px-4 py-2 font-normal">Pagaram</th>
                      <th className="px-4 py-2 font-normal">Comissão</th>
                      <th className="px-4 py-2 font-normal" />
                    </tr>
                  </thead>
                  <tbody>
                    {(stats.data?.modules ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 text-admin-muted">
                          Ainda sem registos. Assim que um membro vir ou clicar no convite, aparece
                          aqui.
                        </td>
                      </tr>
                    ) : (
                      stats.data!.modules.map((m) => {
                        const draft = drafts[m.key] ?? {
                          paid: String(m.paidCount),
                          revenue: (m.revenueCents / 100).toFixed(2),
                        };
                        const rate =
                          m.impressions > 0
                            ? `${((m.clicks / m.impressions) * 100).toFixed(1)}%`
                            : "—";
                        const dirty =
                          Number(draft.paid) !== m.paidCount ||
                          Math.round(Number(draft.revenue) * 100) !== m.revenueCents;
                        return (
                          <tr key={m.key} className="border-t border-admin-border align-middle">
                            <td className="px-4 py-2.5">
                              <p className="text-admin-fg">{m.label}</p>
                              {m.courseTitle ? (
                                <p className="text-[12px] text-admin-faint">{m.courseTitle}</p>
                              ) : null}
                            </td>
                            <td className="px-4 py-2.5 text-admin-muted">{m.impressions}</td>
                            <td className="px-4 py-2.5 text-admin-fg">{m.clicks}</td>
                            <td className="px-4 py-2.5 text-admin-muted">{m.uniqueClickers}</td>
                            <td className="px-4 py-2.5 text-admin-muted">{rate}</td>
                            <td className="px-4 py-2.5">
                              <input
                                type="number"
                                min={0}
                                value={draft.paid}
                                onChange={(e) =>
                                  setDrafts((d) => ({
                                    ...d,
                                    [m.key]: { ...draft, paid: e.target.value },
                                  }))
                                }
                                className="w-20 rounded-md bg-admin-panel-2 px-2 py-1 text-admin-fg outline-none"
                              />
                            </td>
                            <td className="px-4 py-2.5">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={draft.revenue}
                                onChange={(e) =>
                                  setDrafts((d) => ({
                                    ...d,
                                    [m.key]: { ...draft, revenue: e.target.value },
                                  }))
                                }
                                className="w-24 rounded-md bg-admin-panel-2 px-2 py-1 text-admin-fg outline-none"
                              />
                            </td>
                            <td className="px-4 py-2.5">
                              <button
                                type="button"
                                disabled={!dirty || save.isPending}
                                onClick={() =>
                                  save.mutate({
                                    moduleKey: m.key,
                                    moduleLabel: m.label,
                                    paidCount: Number(draft.paid) || 0,
                                    revenueCents: Math.round((Number(draft.revenue) || 0) * 100),
                                  })
                                }
                                className="flex items-center gap-1.5 rounded-md bg-admin-hover px-2.5 py-1 text-[12px] text-admin-fg transition disabled:opacity-40"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Guardar
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl bg-admin-panel">
              <h2 className="px-4 py-3 text-[14px] font-medium text-admin-fg">Onde apareceu</h2>
              <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 xl:grid-cols-4">
                {(stats.data?.byPlacement ?? []).map((p) => (
                  <div key={p.placement} className="rounded-lg bg-admin-panel-2 p-3">
                    <p className="text-[12px] text-admin-muted">
                      {PLACEMENT_LABEL[p.placement] ?? p.placement}
                    </p>
                    <p className="mt-1 text-[13px] text-admin-fg">
                      {p.clicks} cliques · {p.impressions} vistas
                    </p>
                  </div>
                ))}
                {(stats.data?.byPlacement ?? []).length === 0 ? (
                  <p className="px-1 pb-2 text-[13px] text-admin-muted">Sem dados ainda.</p>
                ) : null}
              </div>
            </section>

            <section className="rounded-xl bg-admin-panel">
              <h2 className="px-4 py-3 text-[14px] font-medium text-admin-fg">Quem clicou</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-[13px]">
                  <thead className="text-left text-[12px] text-admin-faint">
                    <tr className="border-t border-admin-border">
                      <th className="px-4 py-2 font-normal">Membro</th>
                      <th className="px-4 py-2 font-normal">Módulo / aula</th>
                      <th className="px-4 py-2 font-normal">Momento</th>
                      <th className="px-4 py-2 font-normal">Cliques</th>
                      <th className="px-4 py-2 font-normal">Último</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats.data?.clickers ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-admin-muted">
                          Ninguém clicou no link até agora.
                        </td>
                      </tr>
                    ) : (
                      stats.data!.clickers.map((c) => (
                        <tr
                          key={`${c.userId}:${c.moduleLabel}`}
                          className="border-t border-admin-border"
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <MemberAvatar name={c.name} avatarUrl={c.avatarUrl} size={28} />
                              <div className="min-w-0">
                                <p className="truncate text-admin-fg">{c.name}</p>
                                {c.email ? (
                                  <p className="truncate text-[12px] text-admin-faint">{c.email}</p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-admin-muted">
                            {c.moduleLabel}
                            {c.lessonTitle ? ` · ${c.lessonTitle}` : ""}
                          </td>
                          <td className="px-4 py-2.5 text-admin-muted">
                            {PLACEMENT_LABEL[c.placement] ?? c.placement}
                          </td>
                          <td className="px-4 py-2.5 text-admin-fg">{c.clicks}</td>
                          <td className="px-4 py-2.5 text-admin-muted">{when(c.lastAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )
      ) : credits.isLoading ? (
        <div className="flex items-center gap-2 p-6 text-[13px] text-admin-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
        </div>
      ) : credits.isError ? (
        <p className="p-6 text-[13px] text-admin-muted">Não foi possível carregar as compras.</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card
              label="Membros que compraram"
              value={String(credits.data?.totals.buyers ?? 0)}
              icon={Users}
            />
            <Card
              label="Compras pagas"
              value={String(credits.data?.totals.purchases ?? 0)}
              icon={Check}
            />
            <Card
              label="Valor recebido"
              value={money(credits.data?.totals.amountCents ?? 0)}
              icon={Coins}
            />
            <Card
              label="Créditos entregues"
              value={String(credits.data?.totals.credits ?? 0)}
              icon={Coins}
            />
          </div>

          <section className="rounded-xl bg-admin-panel">
            <h2 className="px-4 py-3 text-[14px] font-medium text-admin-fg">Compras de créditos</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead className="text-left text-[12px] text-admin-faint">
                  <tr className="border-t border-admin-border">
                    <th className="px-4 py-2 font-normal">Membro</th>
                    <th className="px-4 py-2 font-normal">Pacote</th>
                    <th className="px-4 py-2 font-normal">Créditos</th>
                    <th className="px-4 py-2 font-normal">Valor</th>
                    <th className="px-4 py-2 font-normal">Estado</th>
                    <th className="px-4 py-2 font-normal">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {(credits.data?.rows ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-admin-muted">
                        Ainda ninguém comprou pacotes de créditos.
                      </td>
                    </tr>
                  ) : (
                    credits.data!.rows.map((r) => (
                      <tr key={r.paymentId} className="border-t border-admin-border">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <MemberAvatar name={r.name} avatarUrl={r.avatarUrl} size={28} />
                            <div className="min-w-0">
                              <p className="truncate text-admin-fg">{r.name}</p>
                              {r.email ? (
                                <p className="truncate text-[12px] text-admin-faint">{r.email}</p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-admin-muted">{r.product}</td>
                        <td className="px-4 py-2.5 text-admin-fg">{r.credits || "—"}</td>
                        <td className="px-4 py-2.5 text-admin-fg">
                          {money(r.amountCents, r.currency)}
                        </td>
                        <td className="px-4 py-2.5 text-admin-muted">
                          {r.status === "paid" ? "Pago" : r.status}
                        </td>
                        <td className="px-4 py-2.5 text-admin-muted">{when(r.paidAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
