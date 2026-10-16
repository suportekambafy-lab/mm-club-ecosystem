import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { commercialApplicationsOptions } from "@/lib/commercial/queries";
import { TeamProfile } from "@/components/commercial/team-profile";
import { UpcomingCalls } from "@/components/commercial/scheduled-calls";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowRight, Users, Inbox, Target, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/comercial/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(commercialApplicationsOptions),
  head: () => ({ meta: [{ title: "Início — Comercial MM Club" }, { name: "description", content: "Visão geral das aplicações e da equipa comercial MM Club." }, { property: "og:title", content: "Início — Comercial MM Club" }, { property: "og:description", content: "Aplicações, contactos e equipa comercial num só lugar." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: CommercialHome,
});

function CommercialHome() {
  const { data } = useSuspenseQuery(commercialApplicationsOptions);
  const completed = data.leads.filter(lead => lead.classificacao);
  const stats = [
    { label: "Aplicações recebidas", value: completed.length, icon: Inbox },
    { label: "Perfil A", value: completed.filter(lead => lead.classificacao === "A").length, icon: Target },
    { label: "Por concluir", value: data.leads.length - completed.length, icon: Users },
    { label: "Convertidos", value: data.leads.filter(lead => lead.status === "fechou").length, icon: CheckCircle2 },
  ];
  return <div className="commercial-enter space-y-9">
    <section className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
      <div><p className="mb-4 text-xs font-medium text-commercial-accent">COMERCIAL</p><h1 className="commercial-page-heading">Visão geral</h1><p className="mt-3 text-sm text-muted-foreground">Aplicações e contactos da equipa.</p></div>
      <Button asChild className="h-11"><Link to="/comercial/aplicacoes">Ver aplicações<ArrowUpRight /></Link></Button>
    </section>
    <section aria-label="Resumo das aplicações" className="commercial-stagger grid grid-cols-2 gap-x-5 gap-y-6 border-b border-border pb-8 lg:grid-cols-4">
      {stats.map(({ label, value, icon: Icon }) => <div key={label} className="commercial-stat"><div className="mb-4 flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-xs">{label}</span></div><p className="text-4xl font-semibold tabular-nums">{value.toLocaleString("pt-PT")}</p><p className="mt-2 text-xs text-muted-foreground">Últimos 90 dias</p></div>)}
    </section>
    <UpcomingCalls />
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0"><div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">Próximas conversas</h2><Button asChild variant="ghost" size="sm"><Link to="/comercial/aplicacoes">Ver todas<ArrowRight /></Link></Button></div>
        <div className="border-y border-border">{completed.slice(0, 5).map(lead => <Link to="/comercial/aplicacoes" key={lead.id} className="commercial-lead flex items-center gap-4 border-b border-border py-4 last:border-b-0"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-commercial-accent">{(lead.nome || "M").slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{lead.nome || "Membro MM"}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(lead.created_at).toLocaleDateString("pt-PT")} · {lead.status || "Novo"}</p></div><span className="rounded-md border border-border px-2 py-1 text-xs">Perfil {lead.classificacao}</span><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></Link>)}{!completed.length && <p className="py-12 text-sm text-muted-foreground">Ainda não há aplicações concluídas.</p>}</div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2"><Button asChild variant="outline" className="h-14 justify-between"><Link to="/comercial/utilizadores"><span className="flex items-center gap-3"><Users />Utilizadores</span><ArrowUpRight /></Link></Button><Button asChild variant="outline" className="h-14 justify-between"><Link to="/comercial/equipa"><span className="flex items-center gap-3"><Target />Equipa comercial</span><ArrowUpRight /></Link></Button></div>
      </section>
      <section><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold">A nossa equipa</h2></div><TeamProfile link /></section>
    </div>
    <footer className="border-t border-border pt-5 text-xs text-muted-foreground">MM Club · Equipa comercial</footer>
  </div>;
}