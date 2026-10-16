import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUpRight, Receipt, TrendingUp, Wallet } from "lucide-react";
import { mySalesOptions } from "@/lib/commercial/queries";
import { formatCommission } from "@/lib/commercial/sales-rules";
import { formatSaleAmount } from "@/lib/aplicacao/sale-rules";
import { Button } from "@/components/ui/button";
import { SalesSkeleton } from "@/components/ui/page-skeleton";

export const Route = createFileRoute("/_authenticated/comercial/vendas")({
  loader: ({ context }) => context.queryClient.ensureQueryData(mySalesOptions),
  head: () => ({ meta: [
    { title: "Minhas vendas — Comercial MM Club" },
    { name: "description", content: "Vendas fechadas, faturamento gerado para o MM Club e comissões pessoais." },
    { property: "og:title", content: "Minhas vendas — Comercial MM Club" },
    { property: "og:description", content: "Resultados e comissões das tuas vendas no MM Club." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
  component: MySales,
  pendingComponent: SalesSkeleton,
});

function MySales() {
  const { data: { sales, totals } } = useSuspenseQuery(mySalesOptions);
  const stats = [
    { label: "Faturamento para o MM Club", value: formatSaleAmount(totals.revenueEurCents), icon: TrendingUp },
    { label: "Número de vendas", value: totals.count.toLocaleString("pt-PT"), icon: Receipt },
    { label: "Minhas comissões", value: formatCommission(totals.commissionBrlCents), icon: Wallet },
  ];
  return <div className="commercial-enter space-y-9">
    <section className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
      <div><p className="mb-4 text-xs font-medium text-commercial-accent">RESULTADOS</p><h1 className="commercial-page-heading">Minhas vendas</h1></div>
      <Button asChild variant="outline"><Link to="/comercial/aplicacoes">Ver aplicações<ArrowUpRight /></Link></Button>
    </section>
    <section aria-label="Resumo das minhas vendas" className="commercial-stagger grid gap-6 border-b border-border pb-8 md:grid-cols-3">
      {stats.map(({ label, value, icon: Icon }) => <div key={label} className="commercial-stat min-w-0"><div className="mb-4 flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4 shrink-0" /><span className="text-xs">{label}</span></div><p className="break-words text-3xl font-semibold tabular-nums">{value}</p><p className="mt-2 text-xs text-muted-foreground">Todo o período</p></div>)}
    </section>
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Vendas fechadas</h2><span className="text-sm text-muted-foreground">{totals.count} vendas</span></div>
      {totals.undefinedCommissionCount > 0 && <p className="mb-4 text-sm text-muted-foreground">{totals.undefinedCommissionCount} vendas com comissão por definir.</p>}
      {sales.length ? <div className="overflow-x-auto border-y border-border"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="px-4 py-3">Cliente</th><th className="hidden px-4 py-3 sm:table-cell">Data do fecho</th><th className="px-4 py-3 text-right">Venda · EUR</th><th className="px-4 py-3 text-right">Comissão · BRL</th></tr></thead><tbody>{sales.map(sale => <tr key={sale.id} className="border-b border-border last:border-b-0"><td className="max-w-52 break-words px-4 py-4 font-medium">{sale.nome || "Sem nome"}</td><td className="hidden whitespace-nowrap px-4 py-4 text-muted-foreground sm:table-cell">{sale.sale_closed_at ? new Date(sale.sale_closed_at).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</td><td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">{sale.sale_amount_cents === null ? "—" : formatSaleAmount(sale.sale_amount_cents)}</td><td className="px-4 py-4 text-right font-medium tabular-nums text-commercial-accent">{sale.sale_commission_brl_cents === null ? "Por definir" : formatCommission(sale.sale_commission_brl_cents)}</td></tr>)}</tbody></table></div> : <div className="border-y border-border py-16 text-center"><Receipt className="mx-auto mb-4 h-8 w-8 text-muted-foreground" /><p className="font-medium">Ainda não tens vendas fechadas.</p></div>}
    </section>
  </div>;
}