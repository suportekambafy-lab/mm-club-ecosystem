import { useSuspenseQuery } from "@tanstack/react-query";
import { dailyTeamGoalsOptions, monthlyGoalOptions } from "@/lib/commercial/queries";
import { formatSaleAmount } from "@/lib/aplicacao/sale-rules";
import { CalendarCheck, Handshake } from "lucide-react";

export function RevenuePeriods() {
  const { data } = useSuspenseQuery(monthlyGoalOptions);
  const p = data.periods;
  const cards = [["Faturamento hoje", p.todayCents], ["Últimos 7 dias", p.last7DaysCents], ["Este mês", p.monthCents], ["Último mês", p.lastMonthCents]] as const;
  return <section aria-label="Faturamento" className="commercial-stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
    {cards.map(([label, cents]) => <div key={label} className="card-soft bg-card p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-semibold tabular-nums">{formatSaleAmount(cents)}</p></div>)}
  </section>;
}

function Row({ name, done, target }: { name: string; done: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  return <li className="py-3">
    <div className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{name}</span><span className="tabular-nums text-muted-foreground">{done} / {target}</span></div>
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Meta diária de ${name}`}><div className="h-full rounded-full bg-gradient-to-r from-primary to-commercial-success transition-[width] duration-700" style={{ width: `${pct}%` }} /></div>
  </li>;
}

export function DailyTeamGoals() {
  const { data } = useSuspenseQuery(dailyTeamGoalsOptions);
  const blocks = [
    { title: "SDR · calls marcadas hoje", icon: CalendarCheck, people: data.sdrs, target: data.goals.sdrDailyCalls },
    { title: "Closer · fechos hoje", icon: Handshake, people: data.closers, target: data.goals.closerDailyCloses },
  ];
  return <section aria-label="Metas diárias" className="grid gap-4 md:grid-cols-2">
    {blocks.map(({ title, icon: Icon, people, target }) => <div key={title} className="card-soft bg-card p-5">
      <div className="mb-2 flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</p><span className="text-xs text-muted-foreground">Meta: {target}/dia</span></div>
      <ul className="divide-y divide-border">{people.map(p => <Row key={p.id} name={p.name} done={p.done} target={target} />)}{!people.length && <li className="py-3 text-sm text-muted-foreground">Sem membros nesta função.</li>}</ul>
    </div>)}
  </section>;
}
