import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listLegacyActivations, type LegacyActivationRow } from "@/lib/legacy/legacy-admin.functions";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/ativacoes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Ativações Legacy — MM Club" }, { name: "description", content: "Acompanhar quem ativou o acesso Legacy." }, { property: "og:title", content: "Ativações Legacy — MM Club" }, { property: "og:description", content: "Ativações dos alunos Legacy." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: Page,
});

const LABEL: Record<LegacyActivationRow["status"], string> = { ativou: "Ativou", ja_tinha_conta: "Já tinha conta", por_ativar: "Por ativar" };
const fmt = (d: string | null) => d ? new Date(d).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" }) : "—";

function Page() {
  const read = useServerFn(listLegacyActivations);
  const q = useQuery({ queryKey: ["legacy-activations"], queryFn: () => read(), refetchInterval: 30000 });
  const [filter, setFilter] = useState<"todos" | LegacyActivationRow["status"]>("todos");
  const [search, setSearch] = useState("");
  const rows = q.data ?? [];
  const counts = useMemo(() => ({ ativou: rows.filter(r => r.status === "ativou").length, ja_tinha_conta: rows.filter(r => r.status === "ja_tinha_conta").length, por_ativar: rows.filter(r => r.status === "por_ativar").length }), [rows]);
  const s = search.trim().toLowerCase();
  const shown = rows.filter(r => (filter === "todos" || r.status === filter) && (!s || r.email.includes(s) || r.name.toLowerCase().includes(s)));
  return (
    <div className="space-y-6">
      <div><h1 className="font-display text-2xl text-foreground">Ativações Legacy</h1><p className="text-sm text-muted-foreground">Alunos da lista que ativam em mmclub.pt/ativar. Atualiza a cada 30 segundos.</p></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([["todos", "Total", rows.length], ["ativou", "Ativaram", counts.ativou], ["ja_tinha_conta", "Já tinham conta", counts.ja_tinha_conta], ["por_ativar", "Por ativar", counts.por_ativar]] as const).map(([k, l, n]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-xl border p-4 text-left ${filter === k ? "border-primary" : "border-border"} bg-card`}>
            <div className="text-xs text-muted-foreground">{l}</div><div className="text-2xl font-semibold text-foreground">{q.isLoading ? "…" : n}</div>
          </button>))}
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar nome ou email" className="w-full max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      {q.isLoading ? <Skeleton className="h-64 w-full" /> : q.error ? <p className="text-sm text-destructive">Não foi possível carregar.</p> : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm"><thead className="bg-muted text-left text-muted-foreground"><tr><th className="p-3">Nome</th><th className="p-3">Email</th><th className="p-3">Estado</th><th className="p-3">Ativou em</th><th className="p-3">Último acesso</th></tr></thead>
            <tbody>{shown.map(r => (<tr key={r.email} className="border-t border-border"><td className="p-3">{r.name || "—"}</td><td className="p-3">{r.email}</td><td className="p-3"><span className={r.status === "por_ativar" ? "text-muted-foreground" : "text-primary"}>{LABEL[r.status]}</span></td><td className="p-3">{fmt(r.activatedAt)}</td><td className="p-3">{fmt(r.lastSignInAt)}</td></tr>))}</tbody></table>
        </div>)}
    </div>);
}
