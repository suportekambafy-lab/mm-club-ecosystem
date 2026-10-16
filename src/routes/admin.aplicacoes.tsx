import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, MessageCircle, Phone, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { listLeads, updateLead, saveSettings } from "@/lib/aplicacao/aplicacao.functions";

export const Route = createFileRoute("/admin/aplicacoes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Aplicações — MM Admin" },
      { name: "description", content: "Leads da página de aplicação, classificação, calls marcadas e horários." },
      { property: "og:title", content: "Aplicações — MM Admin" },
      { property: "og:description", content: "Painel de leads da aplicação MM Club." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AplicacoesPage,
});

const STATUS: Record<string, string> = {
  novo: "Novo", incompleto: "Incompleto", em_contato: "Em contacto",
  call_marcada: "Call marcada", fechou: "Fechou", perdido: "Perdido",
};
const CLS_STYLE: Record<string, string> = {
  A: "bg-primary text-primary-foreground",
  B: "bg-muted-foreground/30 text-foreground",
  C: "bg-surface-2 text-muted-foreground ring-1 ring-border",
};
type Lead = Record<string, any>;
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(d);

function AplicacoesPage() {
  const fetchFn = useServerFn(listLeads);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["aplicacao-leads"], queryFn: () => fetchFn() });
  const [fCls, setFCls] = useState(""); const [fStatus, setFStatus] = useState("");
  const [fFrom, setFFrom] = useState(""); const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Lead | null>(null);
  const [tab, setTab] = useState<"leads" | "config">("leads");
  const refresh = () => qc.invalidateQueries({ queryKey: ["aplicacao-leads"] });

  const leads: Lead[] = (data?.leads as Lead[]) ?? [];
  const agByLead = useMemo(() => new Map((data?.agendamentos ?? []).map((a: any) => [a.lead_id, a.data_hora])), [data]);

  const stats = useMemo(() => {
    const today = dayKey(new Date()); const yest = dayKey(new Date(Date.now() - 86400_000));
    const week = Date.now() - 7 * 86400_000;
    const days: { key: string; n: number }[] = [];
    for (let i = 13; i >= 0; i--) days.push({ key: dayKey(new Date(Date.now() - i * 86400_000)), n: 0 });
    let h = 0, o = 0, w = 0; const c: Record<string, number> = { A: 0, B: 0, C: 0 };
    for (const l of leads) {
      const k = dayKey(new Date(l.created_at));
      if (k === today) h++; if (k === yest) o++;
      if (new Date(l.created_at).getTime() >= week) w++;
      if (l.classificacao) c[l.classificacao]++;
      const d = days.find((x) => x.key === k); if (d) d.n++;
    }
    return { h, o, w, c, days };
  }, [leads]);

  const filtered = leads.filter((l) =>
    (!fCls || l.classificacao === fCls) && (!fStatus || l.status === fStatus) &&
    (!fFrom || dayKey(new Date(l.created_at)) >= fFrom) &&
    (!search || `${l.nome ?? ""} ${l.whatsapp ?? ""}`.toLowerCase().includes(search.toLowerCase())));

  const today = dayKey(new Date());
  const callsHoje = (data?.agendamentos ?? [])
    .filter((a: any) => dayKey(new Date(a.data_hora)) === today)
    .sort((a: any, b: any) => a.data_hora.localeCompare(b.data_hora))
    .map((a: any) => ({ ...a, lead: leads.find((l) => l.id === a.lead_id) }));

  function exportCsv() {
    const cols = ["created_at","nome","whatsapp","email","instagram","pais","idade","ocupacao","experiencia","o_que_travou","tempo_dia","verba_anuncios","investimento","decisao","classificacao","status","responsavel","utm_source","utm_medium","utm_campaign","utm_content"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(";"), ...filtered.map((l) => cols.map((c) => esc(l[c])).join(";"))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `aplicacoes-${today}.csv`; a.click();
  }

  if (isLoading) return <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  const max = Math.max(1, ...stats.days.map((d) => d.n));
  const sel = "rounded-lg bg-surface-1 px-3 py-2 text-sm ring-1 ring-border";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Aplicações</h1>
        <div className="flex gap-2">
          {(["leads", "config"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("rounded-full px-4 py-2 text-sm ring-1", tab === t ? "bg-primary text-primary-foreground ring-primary" : "ring-border")}>
              {t === "leads" ? "Leads" : "Horários"}
            </button>
          ))}
        </div>
      </div>

      {tab === "config" ? <Settings initial={data?.settings} onSaved={refresh} /> : <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {[["Hoje", stats.h], ["Ontem", stats.o], ["7 dias", stats.w], ["Lead A", stats.c.A], ["Lead B", stats.c.B], ["Lead C", stats.c.C]].map(([l, n]) => (
          <div key={l as string} className="rounded-xl bg-surface-1 p-4 ring-1 ring-border">
            <p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 font-display text-2xl">{n}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-surface-1 p-4 ring-1 ring-border">
        <p className="mb-3 text-xs text-muted-foreground">Leads por dia — últimos 14 dias</p>
        <div className="flex h-32 items-end gap-1">
          {stats.days.map((d) => (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-1" title={`${d.key}: ${d.n}`}>
              <span className="text-[10px] text-muted-foreground">{d.n || ""}</span>
              <div className="w-full rounded-t bg-primary" style={{ height: `${(d.n / max) * 100}%`, minHeight: d.n ? 4 : 1 }} />
              <span className="text-[9px] text-muted-foreground">{d.key.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-surface-1 p-4 ring-1 ring-border">
        <p className="mb-3 text-sm font-medium">Calls de hoje</p>
        {callsHoje.length === 0 ? <p className="text-sm text-muted-foreground">Sem calls marcadas para hoje.</p> : (
          <ul className="space-y-2 text-sm">
            {callsHoje.map((c: any) => (
              <li key={c.lead_id} className="flex justify-between gap-3">
                <button className="text-left hover:text-primary" onClick={() => c.lead && setOpen(c.lead)}>
                  {new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" }).format(new Date(c.data_hora))} · {c.lead?.nome ?? "—"}
                </button>
                <span className="text-muted-foreground">{c.lead?.whatsapp}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar nome ou telefone" className={cn(sel, "min-w-48 flex-1")} />
        <select value={fCls} onChange={(e) => setFCls(e.target.value)} className={sel}><option value="">Todas</option><option>A</option><option>B</option><option>C</option></select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={sel}><option value="">Todos os estados</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className={sel} aria-label="Desde" />
        <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-border hover:ring-primary"><Download className="h-4 w-4" /> Exportar CSV</button>
      </div>

      <div className="overflow-x-auto rounded-xl ring-1 ring-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-1 text-left text-xs text-muted-foreground">
            <tr><th className="p-3">Lead</th><th className="p-3">Nome</th><th className="p-3">WhatsApp</th><th className="p-3">Estado</th><th className="p-3">Responsável</th><th className="p-3">Data</th></tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} onClick={() => setOpen(l)} className="cursor-pointer border-t border-border hover:bg-surface-1">
                <td className="p-3">{l.classificacao ? <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", CLS_STYLE[l.classificacao])}>{l.classificacao}</span> : "—"}</td>
                <td className="p-3">{l.nome ?? "—"}</td><td className="p-3">{l.whatsapp}</td>
                <td className="p-3">{STATUS[l.status] ?? l.status}</td><td className="p-3">{l.responsavel ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-PT")}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Ainda sem aplicações.</td></tr>}
          </tbody>
        </table>
      </div>
      </>}
      {open && <Detail lead={open} me={data?.me ?? ""} agenda={agByLead.get(open.id) as string | undefined} onClose={() => setOpen(null)} onChanged={(l) => { setOpen(l); refresh(); }} />}
    </div>
  );
}

function Detail({ lead, me, agenda, onClose, onChanged }: { lead: Lead; me: string; agenda?: string; onClose: () => void; onChanged: (l: Lead) => void }) {
  const upd = useServerFn(updateLead);
  const [busy, setBusy] = useState(false);
  const locked = !!lead.responsavel_id && lead.responsavel_id !== me;
  const first = String(lead.nome ?? "").split(" ")[0];
  const wa = `https://wa.me/${String(lead.whatsapp ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(`Olá ${first}, tudo bem? Aqui é da equipa do MM Club, vi a tua aplicação.`)}`;
  async function run(patch: { status?: string; assumir?: boolean }) {
    setBusy(true);
    try { await upd({ data: { id: lead.id, ...(patch as any) } }); onChanged({ ...lead, ...(patch.status ? { status: patch.status } : {}), ...(patch.assumir ? { responsavel_id: me, responsavel: "Tu" } : {}) }); toast.success("Lead atualizado."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro."); }
    finally { setBusy(false); }
  }
  const rows: [string, string][] = [["Email","email"],["Instagram","instagram"],["País","pais"],["Idade","idade"],["Ocupação","ocupacao"],["Experiência","experiencia"],["Tempo por dia","tempo_dia"],["Verba 90 dias","verba_anuncios"],["Investimento","investimento"],["Decisão","decisao"],["Origem","utm_source"],["Campanha","utm_campaign"],["Meio","utm_medium"],["Conteúdo","utm_content"]];
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/70" onClick={onClose}>
      <aside className="h-full w-full max-w-lg overflow-y-auto bg-background p-6 ring-1 ring-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">{lead.nome ?? "Sem nome"}</h2>
            <p className="text-sm text-muted-foreground">{lead.whatsapp}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
        {agenda && <p className="mt-4 rounded-lg p-3 text-sm ring-1 ring-primary/50">Call: {new Date(agenda).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })} (Lisboa)</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
          <a href={`tel:${lead.whatsapp}`} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm ring-1 ring-border"><Phone className="h-4 w-4" /> Ligar</a>
          {!lead.responsavel_id && <button disabled={busy} onClick={() => run({ assumir: true })} className="rounded-full px-4 py-2 text-sm ring-1 ring-border hover:ring-primary">Assumir lead</button>}
        </div>
        {lead.responsavel && <p className="mt-3 text-xs text-muted-foreground">Responsável: {lead.responsavel}{locked && " · bloqueado para ti"}</p>}
        <label className="mt-4 block text-xs text-muted-foreground">Estado
          <select disabled={busy || locked} value={lead.status} onChange={(e) => run({ status: e.target.value })} className="mt-1 block w-full rounded-lg bg-surface-1 px-3 py-2 text-sm text-foreground ring-1 ring-border">
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div className="mt-6 rounded-xl p-4 ring-1 ring-primary/60">
          <p className="text-xs uppercase tracking-wider text-primary">O que te travou</p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{lead.o_que_travou || "Sem resposta."}</p>
        </div>
        <dl className="mt-6 space-y-2 text-sm">
          {rows.map(([l, k]) => <div key={k} className="flex justify-between gap-4 border-b border-border pb-2"><dt className="text-muted-foreground">{l}</dt><dd className="text-right">{lead[k] || "—"}</dd></div>)}
        </dl>
      </aside>
    </div>
  );
}

function Settings({ initial, onSaved }: { initial: any; onSaved: () => void }) {
  const save = useServerFn(saveSettings);
  const [slots, setSlots] = useState<string>(((initial?.slots as string[]) ?? []).join(", "));
  const [blocked, setBlocked] = useState<string[]>((initial?.blocked_days as string[]) ?? []);
  const [day, setDay] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    const list = slots.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    if (list.some((s) => !/^\d{2}:\d{2}$/.test(s))) return toast.error("Usa o formato HH:MM, separado por vírgulas.");
    setBusy(true);
    try { await save({ data: { slots: list, blocked_days: blocked } }); toast.success("Horários guardados."); onSaved(); }
    catch { toast.error("Não foi possível guardar."); } finally { setBusy(false); }
  }
  return (
    <div className="max-w-2xl space-y-6">
      <label className="block text-sm">Horários disponíveis (hora de Lisboa)
        <textarea rows={4} value={slots} onChange={(e) => setSlots(e.target.value)} className="mt-2 w-full rounded-lg bg-surface-1 p-3 text-sm ring-1 ring-border" />
      </label>
      <div>
        <p className="text-sm">Dias bloqueados</p>
        <div className="mt-2 flex gap-2">
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="rounded-lg bg-surface-1 px-3 py-2 text-sm ring-1 ring-border" />
          <button onClick={() => day && !blocked.includes(day) && setBlocked([...blocked, day].sort())} className="rounded-lg px-3 py-2 text-sm ring-1 ring-border">Adicionar</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {blocked.map((d) => <button key={d} onClick={() => setBlocked(blocked.filter((x) => x !== d))} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ring-1 ring-border">{d} <X className="h-3 w-3" /></button>)}
        </div>
      </div>
      <button disabled={busy} onClick={submit} className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">Guardar</button>
    </div>
  );
}
