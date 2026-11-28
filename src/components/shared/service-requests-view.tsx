import { useState } from "react";
import type { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Loader2, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { listServiceRequests, updateServiceRequest } from "@/lib/services/service-requests.functions";
import { canScheduleServiceCall, serviceUpdateSchema } from "@/lib/services/call-rules";
import { isLeadLocked } from "@/lib/aplicacao/lead-presentation";
import { parseCallDateTime } from "@/lib/aplicacao/call-rules";

const SERVICE: Record<string, string> = { loja_pronta: "Loja pronta", consultoria_1h: "Consultoria de 1h", mentoria_individual: "Mentoria individual" };
const STATUS = { novo: "Novo", em_contacto: "Em contacto", call_marcada: "Call marcada", concluido: "Concluído", descartado: "Descartado" };
type RequestRow = Awaited<ReturnType<typeof listServiceRequests>>["requests"][number];

export function ServiceRequestsView({ commercial = false }: { commercial?: boolean }) {
  const qc = useQueryClient();
  const list = useServerFn(listServiceRequests);
  const update = useServerFn(updateServiceRequest);
  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [callTime, setCallTime] = useState("");
  const [closerId, setCloserId] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ["service-applications"], refetchInterval: 30_000, queryFn: () => list() });
  function schedule(row: RequestRow) { setSelected(row); setCallTime(""); setCloserId(row.lead?.responsavel_id ?? ""); }
  async function save(input: z.infer<typeof serviceUpdateSchema>) {
    if (busy) return;
    setBusy(true);
    try {
      await update({ data: input });
      setSelected(null);
      await Promise.all(["service-applications", "commercial-my-calls", "aplicacao-leads", "commercial-home-applications", "commercial-daily-goals"].map(key => qc.invalidateQueries({ queryKey: [key] })));
      toast.success(input.status === "call_marcada" ? "Call marcada na agenda do closer." : "Estado atualizado.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível atualizar."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <h1 className="text-2xl font-semibold text-foreground">Serviços individuais</h1>
    {isLoading ? <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div> : error ? <p className="text-sm text-destructive">Erro ao carregar os pedidos.</p> : !data?.requests.length ? <p className="text-sm text-muted-foreground">Ainda não há pedidos.</p> : <div className="overflow-x-auto border border-border">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground"><tr>{["Nome", "Call / Closer", "Estado", "Serviço", "Contacto", "Email", "Mensagem", "Data"].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{data.requests.map(r => {
          const locked = Boolean(r.lead && isLeadLocked(r.lead, data.me));
          const canSchedule = canScheduleServiceCall(r.lead, data.me, data.roles);
          return <tr key={r.id} className="border-t border-border align-top">
            <td className="px-4 py-3 font-medium text-foreground">{r.full_name}</td>
            <td className="min-w-56 px-4 py-3">
              {r.lead?.call_scheduled_at && r.lead.status === "call_marcada" && <p className="text-primary">{new Date(r.lead.call_scheduled_at).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" })} · Lisboa</p>}
              {r.lead?.responsavel && <p className="mt-1">Closer: {r.lead.responsavel}</p>}
              {r.lead?.call_scheduled_by && <p className="mt-1 text-xs text-muted-foreground">Marcado por: {data.names[r.lead.call_scheduled_by] ?? "Equipa"}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={busy || !canSchedule} onClick={() => schedule(r)}><CalendarDays className="h-4 w-4" />{r.status === "call_marcada" ? "Alterar call" : "Marcar call"}</Button>
                {r.lead_id && <Button asChild variant="ghost" size="sm"><Link to={commercial ? "/comercial/aplicacoes" : "/admin/aplicacoes"}><ArrowUpRight className="h-4 w-4" />CRM</Link></Button>}
              </div>
            </td>
            <td className="px-4 py-3"><select aria-label={`Estado de ${r.full_name}`} disabled={busy || locked || r.lead?.status === "fechou"} className="rounded-md border border-input bg-background px-2 py-1 disabled:opacity-50" value={r.status} onChange={e => {
              const value = e.target.value;
              if (value === "call_marcada") schedule(r);
              else if (value === "novo" || value === "em_contacto" || value === "concluido" || value === "descartado") void save({ id: r.id, status: value });
            }}>{Object.entries(STATUS).map(([k,v]) => <option key={k} value={k} disabled={(k === "call_marcada" && !canSchedule) || (k === "concluido" && Boolean(r.lead_id))}>{v}</option>)}</select></td>
            <td className="px-4 py-3"><Badge variant="secondary">{SERVICE[r.service] ?? r.service}</Badge></td>
            <td className="whitespace-nowrap px-4 py-3">{locked ? <span className="text-muted-foreground">{r.phone}</span> : <a className="text-primary hover:underline" href={`https://wa.me/${r.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{r.phone}</a>}</td>
            <td className="px-4 py-3">{locked ? <span className="text-muted-foreground">{r.email}</span> : <a className="text-primary hover:underline" href={`mailto:${r.email}`}>{r.email}</a>}</td>
            <td className="max-w-xs px-4 py-3 text-muted-foreground"><p className="line-clamp-3" title={r.message ?? undefined}>{r.message || "—"}</p></td>
            <td className="whitespace-nowrap px-4 py-3">{new Date(r.created_at).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" })}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!busy && !open) setSelected(null); }}><DialogContent className={`admin-shell max-w-md text-foreground ${commercial ? "commercial-shell sale-dialog-dark" : ""}`}>
      <DialogTitle>Marcar call</DialogTitle><DialogDescription>{selected?.full_name} · {selected ? SERVICE[selected.service] : ""}</DialogDescription>
      <form className="mt-4 space-y-5" onSubmit={e => {
        e.preventDefault(); if (!selected) return;
        const at = parseCallDateTime(callTime);
        if (!at || Date.parse(at) <= Date.now()) return toast.error("Escolhe uma data e hora futuras.");
        if (!closerId) return toast.error("Escolhe o closer da call.");
        void save({ id: selected.id, status: "call_marcada", callScheduledAt: at, closerId });
      }}>
        <label className="block text-sm">Data e hora (Lisboa)<input type="datetime-local" required autoFocus aria-label="Data e hora da call" disabled={busy} value={callTime} onChange={e => setCallTime(e.target.value)} className="mt-2 h-12 w-full min-w-0 rounded-md border border-border bg-muted px-3 text-foreground" /></label>
        <label className="block text-sm">Closer da call<select required aria-label="Closer da call" disabled={busy} value={closerId} onChange={e => setCloserId(e.target.value)} className="mt-2 h-12 w-full rounded-md border border-border bg-muted px-3 text-foreground"><option value="">Escolher closer…</option>{data?.closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" className="btn-dialog-ghost" disabled={busy} onClick={() => setSelected(null)}>Cancelar</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Confirmar call</Button></div>
      </form>
    </DialogContent></Dialog>
  </div>;
}
