import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { commercialApplicationsOptions, dailyTeamGoalsOptions, monthlyGoalOptions } from "@/lib/commercial/queries";
import { DailyTeamGoals, RevenueInPeriod, RevenuePeriods } from "@/components/commercial/dashboard-panels";
import { MonthlyGoal } from "@/components/commercial/monthly-goal";
import { TeamProfile } from "@/components/commercial/team-profile";
import { UpcomingCalls } from "@/components/commercial/scheduled-calls";
import { Button } from "@/components/ui/button";
import { HomeSkeleton } from "@/components/ui/page-skeleton";
import { useMemo, useState } from "react";
import { dayWindow } from "@/lib/commercial/goal-rules";
import { ArrowUpRight, ArrowRight, Users, Inbox, Target, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/comercial/")({
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(commercialApplicationsOptions),
    context.queryClient.ensureQueryData(monthlyGoalOptions),
    context.queryClient.ensureQueryData(dailyTeamGoalsOptions),
  ]),
  head: () => ({ meta: [{ title: "Início — Comercial MM Club" }, { name: "description", content: "Visão geral das aplicações e da equipa comercial MM Club." }, { property: "og:title", content: "Início — Comercial MM Club" }, { property: "og:description", content: "Aplicações, contactos e equipa comercial num só lugar." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: CommercialHome,
  pendingComponent: HomeSkeleton,
});

function CommercialHome() {
  const { data } = useSuspenseQuery(commercialApplicationsOptions);
  const [period, setPeriod] = useState<Period>("90");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const range = useMemo(() => periodRange(period, from, to), [period, from, to]);
  const leads = data.leads.filter(l => inPeriod(l.created_at, period, from, to));
  const completed = leads.filter(lead => lead.classificacao);
  const stats = [
    { label: "Aplicações recebidas", value: completed.length, icon: Inbox },
    { label: "Perfil A", value: completed.filter(lead => lead.classificacao === "A").length, icon: Target },
    { label: "Por concluir", value: leads.length - completed.length, icon: Users },
    { label: "Convertidos", value: leads.filter(lead => lead.status === "fechou").length, icon: CheckCircle2 },
  ];
  return <div className="commercial-enter space-y-9">
    <section className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
      <div><p className="mb-4 text-xs font-medium text-commercial-accent">COMERCIAL</p><h1 className="commercial-page-heading">Visão geral</h1><p className="mt-3 text-sm text-muted-foreground">Aplicações e contactos da equipa.</p></div>
      <Button asChild className="btn-arrow h-11 pl-5"><Link to="/comercial/aplicacoes">Ver aplicações<ArrowUpRight /></Link></Button>
    </section>
    <section aria-label="Filtrar período" className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs text-muted-foreground">Período:</span>
      {PERIODS.map(([k, l]) => <Button key={k} size="sm" variant={period === k ? "default" : "outline"} onClick={() => setPeriod(k)}>{l}</Button>)}
      {period === "custom" && <span className="flex items-center gap-2 text-xs"><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2" />até<input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2" /></span>}
    </section>
    {range && <RevenueInPeriod fromIso={range.fromIso} toIso={range.toIso} label={periodLabel(period, from, to)} />}
    <RevenuePeriods />
    <MonthlyGoal />
    <DailyTeamGoals />
    <section aria-label="Resumo das aplicações" className="commercial-stagger grid grid-cols-2 gap-x-5 gap-y-6 border-b border-border pb-8 lg:grid-cols-4">
      {stats.map(({ label, value, icon: Icon }) => <div key={label} className="commercial-stat"><div className="mb-4 flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-xs">{label}</span></div><p className="text-4xl font-semibold tabular-nums">{value.toLocaleString("pt-PT")}</p><p className="mt-2 text-xs text-muted-foreground">{periodLabel(period, from, to)}</p></div>)}
    </section>
    <section aria-label="A nossa equipa" className="border-b border-border pb-8"><div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">A nossa equipa</h2><Button asChild variant="ghost" size="sm"><Link to="/comercial/equipa">Ver equipa<ArrowRight /></Link></Button></div><div className="commercial-stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><TeamProfile link /></div></section>
    <UpcomingCalls />
      <section className="min-w-0"><div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">Próximas conversas</h2><Button asChild variant="ghost" size="sm"><Link to="/comercial/aplicacoes">Ver todas<ArrowRight /></Link></Button></div>
        <div className="border-y border-border">{completed.slice(0, 5).map(lead => <Link to="/comercial/aplicacoes" search={{ lead: lead.id }} key={lead.id} className="commercial-lead flex items-center gap-4 border-b border-border py-4 last:border-b-0"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-commercial-accent">{(lead.nome || "M").slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{lead.nome || "Membro MM"}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(lead.created_at).toLocaleDateString("pt-PT")} · {lead.status || "Novo"}</p></div><span className="rounded-md border border-border px-2 py-1 text-xs">Perfil {lead.classificacao}</span><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></Link>)}{!completed.length && <p className="py-12 text-sm text-muted-foreground">Ainda não há aplicações concluídas.</p>}</div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2"><Button asChild variant="outline" className="group h-14 justify-between rounded-2xl"><Link to="/comercial/utilizadores"><span className="flex items-center gap-3"><Users />Utilizadores</span><span className="grid h-8 w-8 place-items-center rounded-full bg-muted transition-transform duration-200 group-hover:rotate-45"><ArrowUpRight className="h-4 w-4" /></span></Link></Button><Button asChild variant="outline" className="group h-14 justify-between rounded-2xl"><Link to="/comercial/equipa"><span className="flex items-center gap-3"><Target />Equipa comercial</span><span className="grid h-8 w-8 place-items-center rounded-full bg-muted transition-transform duration-200 group-hover:rotate-45"><ArrowUpRight className="h-4 w-4" /></span></Link></Button></div>
      </section>
    <footer className="border-t border-border pt-5 text-xs text-muted-foreground">MM Club · Equipa comercial</footer>
  </div>;
}
type Period = "today" | "yesterday" | "7" | "30" | "90" | "custom";
const PERIODS: [Period, string][] = [["today", "Hoje"], ["yesterday", "Ontem"], ["7", "7 dias"], ["30", "30 dias"], ["90", "90 dias"], ["custom", "Personalizado"]];
const lisbonDay = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Lisbon" });
function inPeriod(iso: string, p: Period, from: string, to: string) {
  const day = lisbonDay(new Date(iso)); const now = new Date();
  if (p === "today") return day === lisbonDay(now);
  if (p === "yesterday") return day === lisbonDay(new Date(now.getTime() - 864e5));
  if (p === "custom") return (!from || day >= from) && (!to || day <= to);
  return day >= lisbonDay(new Date(now.getTime() - (Number(p) - 1) * 864e5));
}
function periodLabel(p: Period, from: string, to: string) {
  if (p === "custom") return from || to ? `${from || "…"} → ${to || "…"}` : "Escolhe as datas";
  return PERIODS.find(([k]) => k === p)?.[1] ?? "";
}

function periodRange(p: Period, from: string, to: string): { fromIso: string; toIso: string } | null {
  const now = new Date(); const day = (d: Date) => dayWindow(d);
  const at = (ymd: string) => new Date(`${ymd}T12:00:00Z`);
  if (p === "today") { const w = day(now); return { fromIso: w.startIso, toIso: w.endIso }; }
  if (p === "yesterday") { const w = day(new Date(now.getTime() - 864e5)); return { fromIso: w.startIso, toIso: w.endIso }; }
  if (p === "custom") { if (!from || !to || from > to) return null; return { fromIso: day(at(from)).startIso, toIso: day(at(to)).endIso }; }
  return { fromIso: day(new Date(now.getTime() - (Number(p) - 1) * 864e5)).startIso, toIso: day(now).endIso };
}
