import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listCommercialTransactions } from "@/lib/commercial/transactions.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TeamSkeleton } from "@/components/ui/page-skeleton";

const txOptions = queryOptions({ queryKey: ["commercial-transactions"], queryFn: () => listCommercialTransactions(), refetchInterval: 30_000 });
const STATUS: Record<string, string> = { paid: "Pago", pending: "Pendente", failed: "Falhou", expired: "Expirado", canceled: "Cancelado", cancelled: "Cancelado", refunded: "Reembolsado", partially_refunded: "Reemb. parcial", chargeback: "Chargeback", authorized: "Autorizado", processing: "Em processamento" };

export const Route = createFileRoute("/_authenticated/comercial/transacoes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(txOptions),
  head: () => ({ meta: [{ title: "Transações — Comercial MM Club" }, { name: "description", content: "Todas as transações MMpay e assinaturas do MM Club." }, { property: "og:title", content: "Transações — Comercial MM Club" }, { property: "og:description", content: "Todas as transações do MM Club." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: Transactions,
  pendingComponent: TeamSkeleton,
});

function Transactions() {
  const { data } = useSuspenseQuery(txOptions);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const rows = useMemo(() => data.filter(r => (status === "all" || r.status === status) && `${r.buyer ?? ""} ${r.email ?? ""} ${r.product ?? ""}`.toLowerCase().includes(q.toLowerCase())), [data, q, status]);
  const paid = rows.filter(r => r.status === "paid").reduce((s, r) => s + r.amountCents, 0);
  const fmt = (c: number, cur = "EUR") => new Intl.NumberFormat("pt-PT", { style: "currency", currency: cur }).format(c / 100);
  return <div className="commercial-enter">
    <div className="mb-8 flex items-center justify-between border-b border-border pb-4 text-xs text-muted-foreground"><span>Comercial / Transações</span><span>MM Club</span></div>
    <h1 className="commercial-page-heading">Transações</h1>
    <p className="mt-2 text-sm text-muted-foreground">{rows.length} transações · {fmt(paid)} pagos</p>
    <div className="my-6 flex flex-wrap gap-3">
      <Input placeholder="Procurar nome, email ou produto" value={q} onChange={e => setQ(e.target.value)} className="max-w-xs" />
      <select value={status} onChange={e => setStatus(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="all">Todos os estados</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
    </div>
    <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr className="border-b border-border">{["Data", "Cliente", "Produto", "Origem", "Método", "Valor", "Estado"].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
      <tbody>{rows.slice(0, 500).map(r => <tr key={r.id} className="border-b border-border last:border-0">
        <td className="whitespace-nowrap px-4 py-3">{new Date(r.date).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Lisbon" })}</td>
        <td className="px-4 py-3"><p className="font-medium">{r.buyer || "—"}</p><p className="text-xs text-muted-foreground">{r.email}</p></td>
        <td className="px-4 py-3">{r.product || "—"}</td>
        <td className="px-4 py-3">{r.source}</td>
        <td className="px-4 py-3 capitalize">{r.method || "—"}</td>
        <td className="whitespace-nowrap px-4 py-3 font-medium">{fmt(r.amountCents, r.currency)}</td>
        <td className="px-4 py-3"><Badge variant={r.status === "paid" ? "default" : "secondary"}>{STATUS[r.status] ?? r.status}</Badge></td>
      </tr>)}</tbody></table>
      {!rows.length && <p className="p-8 text-center text-sm text-muted-foreground">Sem transações.</p>}
    </div>
  </div>;
}
