import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, CalendarDays, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { myCallsOptions } from "@/lib/commercial/queries";
import { callCountdown, callReminderStage, type ScheduledCall } from "@/lib/aplicacao/call-rules";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function useClock() {
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return now;
}
function CallRow({ call, now, commercial }: { call: ScheduledCall; now: number; commercial: boolean }) {
  return <Link to={commercial ? "/comercial/aplicacoes" : "/admin/aplicacoes"} search={{ lead: call.id }} className="flex items-center gap-3 border-b border-border py-4 last:border-0">
    <CalendarDays className="h-5 w-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{call.nome || "Contacto"}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(call.call_scheduled_at).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · Lisboa</p><p className="mt-2 text-sm font-semibold tabular-nums text-primary">{now ? callCountdown(call.call_scheduled_at, now) : "—"}</p></div><ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
  </Link>;
}
export function UpcomingCalls() {
  const { data, isPending, isError } = useQuery(myCallsOptions);
  const now = useClock();
  return <section aria-label="As minhas próximas calls" className="border-b border-border pb-8"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold">As minhas próximas calls</h2><CalendarDays className="h-5 w-5 text-muted-foreground" /></div>
    {data?.calls.map(call => <CallRow key={call.id} call={call} now={now} commercial />)}
    {!data?.calls.length && <p className="py-5 text-sm text-muted-foreground">{isPending ? "A consultar calls…" : isError ? "Não foi possível consultar as calls." : "Não tens calls marcadas."}</p>}
  </section>;
}
export function CallNotificationBell({ commercial = false }: { commercial?: boolean }) {
  const { data, isError } = useQuery(myCallsOptions);
  const now = useClock();
  const seen = useRef(new Set<string>());
  useEffect(() => {
    if (!data || !now) return;
    for (const call of data.calls) {
      const stage = callReminderStage(call.call_scheduled_at, now);
      if (!stage) continue;
      const key = `${data.me}:${call.id}:${call.call_scheduled_at}:${stage}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      try { if (sessionStorage.getItem(key)) continue; sessionStorage.setItem(key, "1"); } catch { /* In-memory dedup remains available. */ }
      toast.info(stage === "now" ? "Está na hora da tua call" : "A tua call começa em breve", { id: key, description: `${call.nome || "Contacto"} · ${callCountdown(call.call_scheduled_at, now)}`, duration: 10000 });
    }
  }, [data, now]);
  const calls = data?.calls ?? [];
  return <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative shrink-0" aria-label="Notificações de calls" title="Notificações de calls"><Bell className="h-5 w-5" />{calls.length > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{calls.length}</span>}</Button></PopoverTrigger><PopoverContent align="end" className={`admin-shell ${commercial ? "commercial-shell" : ""} max-h-[70vh] w-80 max-w-[calc(100vw-32px)] overflow-y-auto bg-popover text-popover-foreground`}><h2 className="font-semibold">Notificações · Calls</h2><p className="mt-1 text-xs text-muted-foreground">As tuas próximas calls</p>{calls.map(call => <CallRow key={call.id} call={call} now={now} commercial={commercial} />)}{!calls.length && <p className="py-6 text-sm text-muted-foreground">{isError ? "Não foi possível consultar as calls." : "Sem calls marcadas."}</p>}</PopoverContent></Popover>;
}