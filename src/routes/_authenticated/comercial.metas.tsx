import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getCommercialGoals, saveCommercialGoals } from "@/lib/commercial/goal.functions";
import { monthlyWindow } from "@/lib/commercial/goal-rules";
import { parseSaleAmount } from "@/lib/aplicacao/sale-rules";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export const Route = createFileRoute("/_authenticated/comercial/metas")({
  beforeLoad: ({ context }) => { if (!(context as { isAdmin?: boolean }).isAdmin) throw redirect({ to: "/comercial" }); },
  head: () => ({ meta: [{ title: "Metas — Comercial MM Club" }, { name: "description", content: "Definir metas mensais e diárias da equipa comercial." }, { property: "og:title", content: "Metas — Comercial MM Club" }, { property: "og:description", content: "Metas de faturamento, calls e fechos." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: GoalsPage,
  pendingComponent: PageSkeleton,
});

function GoalsPage() {
  const [monthKey, setMonthKey] = useState(() => monthlyWindow(new Date()).monthKey);
  const get = useServerFn(getCommercialGoals); const save = useServerFn(saveCommercialGoals);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["commercial-goals", monthKey], queryFn: () => get({ data: { monthKey } }) });
  const [revenue, setRevenue] = useState(""); const [calls, setCalls] = useState(""); const [closes, setCloses] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) { setRevenue(String(data.revenueGoalCents / 100)); setCalls(String(data.sdrDailyCalls)); setCloses(String(data.closerDailyCloses)); } }, [data]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseSaleAmount(revenue);
    const c = Number(calls), f = Number(closes);
    if (cents == null || !Number.isInteger(c) || !Number.isInteger(f) || c < 0 || f < 0) { toast.error("Verifica os valores."); return; }
    setSaving(true);
    try {
      await save({ data: { monthKey, revenueGoalCents: cents, sdrDailyCalls: c, closerDailyCloses: f } });
      toast.success("Metas guardadas");
      qc.invalidateQueries({ queryKey: ["commercial-goals"] }); qc.invalidateQueries({ queryKey: ["commercial-monthly-goal"] }); qc.invalidateQueries({ queryKey: ["commercial-daily-goals"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao guardar."); } finally { setSaving(false); }
  }
  const field = "mt-2 w-full rounded-xl bg-surface-1 px-4 py-3 text-sm ring-1 ring-border focus:outline-none focus:ring-primary";
  return <div className="commercial-enter max-w-xl space-y-8">
    <div className="border-b border-border pb-6"><p className="mb-4 text-xs font-medium text-commercial-accent">ADMINISTRADOR</p><h1 className="commercial-page-heading">Metas</h1><p className="mt-3 text-sm text-muted-foreground">Só tu vês esta página. As metas aparecem para toda a equipa na visão geral.</p></div>
    {isLoading ? <PageSkeleton /> : <form onSubmit={submit} className="card-soft space-y-5 bg-card p-6">
      <label className="block text-sm">Mês<input type="month" value={monthKey} onChange={e => e.target.value && setMonthKey(e.target.value)} className={field} /></label>
      <label className="block text-sm">Meta de faturamento do mês (€)<input inputMode="decimal" value={revenue} onChange={e => setRevenue(e.target.value)} className={field} /></label>
      <label className="block text-sm">SDR · calls marcadas por dia<input type="number" min={0} value={calls} onChange={e => setCalls(e.target.value)} className={field} /></label>
      <label className="block text-sm">Closer · fechos por dia<input type="number" min={0} value={closes} onChange={e => setCloses(e.target.value)} className={field} /></label>
      <Button type="submit" disabled={saving} className="h-11 w-full">{saving ? "A guardar…" : "Guardar metas"}</Button>
    </form>}
  </div>;
}
