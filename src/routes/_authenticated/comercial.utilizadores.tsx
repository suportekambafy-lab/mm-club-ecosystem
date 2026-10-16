import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { commercialMembers, changeCommercialRole, giveCommercialAccess } from "@/lib/commercial/commercial.functions";
import { Button } from "@/components/ui/button";
import { KeyRound, Search, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { manualAccessSchema } from "@/lib/commercial/rules";

const options = queryOptions({ queryKey: ["commercial-members"], queryFn: () => commercialMembers({ data: { search: "" } }) });
export const Route = createFileRoute("/_authenticated/comercial/utilizadores")({
  loader: ({ context }) => context.queryClient.ensureQueryData(options),
  head: () => ({ meta: [
    { title:"Utilizadores — Comercial MM Club" }, {name:"description",content:"Utilizadores e acessos manuais da equipa comercial MM Club."},
    {property:"og:title",content:"Utilizadores — Comercial MM Club"},{property:"og:description",content:"Utilizadores e acessos da equipa SDR e closer."},
    {property:"og:type",content:"website"},{name:"twitter:card",content:"summary"},{name:"robots",content:"noindex,nofollow"},
  ] }), component: CommercialMembers,
});
type Member = Awaited<ReturnType<typeof commercialMembers>>[number];
const date = (value: string) => new Date(value).toLocaleDateString("pt-PT");
function CommercialMembers() {
  const { isAdmin } = Route.useRouteContext();
  const { data } = useSuspenseQuery(options);
  const qc = useQueryClient();
  const find = useServerFn(commercialMembers);
  const give = useServerFn(giveCommercialAccess);
  const changeRole = useServerFn(changeCommercialRole);
  const [search,setSearch] = useState("");
  const [results,setResults] = useState<Member[] | null>(null);
  const [selected,setSelected] = useState<Member | null>(null);
  const [months,setMonths] = useState<3|6|12>(6);
  const [reason,setReason] = useState("");
  const [busy,setBusy] = useState(false);
  const [roleBusy,setRoleBusy] = useState<string | null>(null);
  const members = results ?? data;
  async function searchMembers(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { setResults(await find({data:{search}})); } catch { toast.error("Não foi possível pesquisar."); } finally { setBusy(false); }
  }
  async function grant(e: React.FormEvent) {
    e.preventDefault(); if(!selected) return;
    const parsed = manualAccessSchema.safeParse({userId:selected.id,months,reason});
    if(!parsed.success) return toast.error("Indica o motivo do acesso (mínimo 3 caracteres).");
    setBusy(true);
    try {
      const result = await give({data:parsed.data});
      toast.success(`Acesso atribuído até ${date(result.expiresAt)}`);
      setSelected(null); setReason(""); setResults(null); setSearch("");
      await qc.invalidateQueries({queryKey:["commercial-members"]});
    } catch(e) { toast.error(e instanceof Error ? e.message : "Não foi possível atribuir acesso."); } finally { setBusy(false); }
  }
  async function assign(member: Member, role: "sdr"|"closer"|"none") {
    setRoleBusy(member.id);
    try { await changeRole({data:{userId:member.id,role}}); toast.success("Permissão da equipa atualizada."); setResults(null); await qc.invalidateQueries({queryKey:["commercial-members"]}); }
    catch(e) { toast.error(e instanceof Error ? e.message : "Não foi possível alterar a equipa."); } finally {setRoleBusy(null);}
  }
  return <div className="space-y-6">
    <div><h1 className="font-display text-3xl">Utilizadores</h1><p className="mt-2 text-sm text-admin-muted">MM Club · SDR & Closer</p></div>
    <form onSubmit={searchMembers} className="flex max-w-2xl gap-2">
      <label className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-admin-muted"/><input aria-label="Pesquisar utilizadores" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome ou email" className="h-10 w-full rounded-md border border-admin-border bg-admin-panel pl-10 pr-3 text-sm" /></label>
      <Button type="submit" disabled={busy} variant="outline">{busy ? <Loader2 className="animate-spin"/> : <Search/>}Pesquisar</Button>
    </form>
    <div className="overflow-x-auto rounded-lg border border-admin-border">
      <table className="w-full text-left text-sm"><thead className="bg-admin-panel text-admin-muted"><tr><th className="p-4">Utilizador</th><th className="p-4">Acesso ao clube</th>{isAdmin && <th className="p-4">Equipa</th>}<th className="p-4">Ações</th></tr></thead>
      <tbody>{members.map(member=><tr key={member.id} className="border-t border-admin-border">
        <td className="p-4"><p className="font-medium">{member.display_name || "Membro MM"}</p><p className="mt-1 text-xs text-admin-muted">{member.email || "—"}</p></td>
        <td className="p-4"><p className={member.hasAccess ? "text-primary" : "text-admin-muted"}>{member.hasAccess ? "Ativo" : "Sem acesso"}</p>{member.hasAccess && <p className="mt-1 text-xs text-admin-muted">{member.expiresAt ? `Até ${date(member.expiresAt)}` : "Sem data de fim"}</p>}</td>
        {isAdmin && <td className="p-4"><select aria-label={`Função de ${member.display_name || member.id}`} value={member.role ?? "none"} disabled={roleBusy === member.id} onChange={e=>void assign(member,e.target.value as "sdr"|"closer"|"none")} className="rounded-md border border-admin-border bg-admin-panel p-2"><option value="none">Sem função comercial</option><option value="sdr">SDR</option><option value="closer">Closer</option></select></td>}
        <td className="p-4"><Button variant="outline" onClick={()=>{setSelected(member);setReason("");}}><KeyRound/>Dar acesso</Button></td>
      </tr>)}{!members.length && <tr><td colSpan={isAdmin ? 4:3} className="p-8 text-center text-admin-muted">Nenhum utilizador encontrado.</td></tr>}</tbody></table>
    </div>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4"><section role="dialog" aria-modal="true" aria-labelledby="manual-access-title" className="w-full max-w-md rounded-lg border border-admin-border bg-admin-bg p-6">
      <div className="flex items-center justify-between gap-3"><h2 id="manual-access-title" className="text-xl font-semibold">Dar acesso ao MM Club</h2><Button variant="ghost" size="icon" aria-label="Fechar" disabled={busy} onClick={()=>setSelected(null)}><X/></Button></div>
      <p className="mt-2 text-sm text-admin-muted">{selected.display_name} · {selected.email}</p>
      <form onSubmit={grant} className="mt-6 space-y-5">
        <fieldset><legend className="mb-2 text-sm">Duração</legend><div className="grid grid-cols-3 gap-2">{([3,6,12] as const).map(m=><Button key={m} type="button" variant={m===months ? "default":"outline"} aria-pressed={m===months} onClick={()=>setMonths(m)}>{m} meses</Button>)}</div></fieldset>
        <label className="block text-sm">Motivo<textarea required minLength={3} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} className="mt-2 min-h-24 w-full rounded-md border border-admin-border bg-admin-panel p-3" /></label>
        <p className="text-xs text-admin-muted">Acesso até {date(new Date(new Date().setMonth(new Date().getMonth()+months)).toISOString())}. Não cria cobranças nem altera a subscrição existente.</p>
        <Button type="submit" disabled={busy} className="w-full">{busy ? <Loader2 className="animate-spin"/>:<KeyRound/>}Confirmar acesso</Button>
      </form>
    </section></div>}
  </div>;
}