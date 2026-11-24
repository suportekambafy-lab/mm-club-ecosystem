import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { FEATURED_TEAM } from "@/components/commercial/team-profile";
import { TeamSkeleton } from "@/components/ui/page-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { listCommercialTeam, addCommercialTeamMember, updateCommercialTeamMember, removeCommercialTeamMember } from "@/lib/commercial/team.functions";

const teamOptions = queryOptions({ queryKey: ["commercial-team"], queryFn: () => listCommercialTeam() });
type Member = Awaited<ReturnType<typeof listCommercialTeam>>[number];

export const Route = createFileRoute("/_authenticated/comercial/equipa")({
  loader: ({ context }) => context.queryClient.ensureQueryData(teamOptions),
  head: () => ({ meta: [{ title: "Equipa — Comercial MM Club" }, { name: "description", content: "Conhece a equipa SDR e Closer do MM Club." }, { property: "og:title", content: "Equipa — Comercial MM Club" }, { property: "og:description", content: "As pessoas da equipa comercial MM Club." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: CommercialTeam,
  pendingComponent: TeamSkeleton,
});

const fallbackPhoto = (name: string | null) => FEATURED_TEAM.find(p => name?.toLocaleLowerCase().includes(p.match))?.photo ?? null;
const roleLabel = (r: string) => r === "sdr" ? "SDR" : "Closer";

function fileToBase64(file: File) {
  return new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1] ?? ""); fr.onerror = rej; fr.readAsDataURL(file); });
}

function CommercialTeam() {
  const { isAdmin } = Route.useRouteContext();
  const { data } = useSuspenseQuery(teamOptions);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Member | null>(null);
  const [adding, setAdding] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["commercial-team"] });

  async function remove(m: Member) {
    if (!confirm(`Remover ${m.name ?? m.email} da equipa comercial? A conta no MM Club mantém-se.`)) return;
    try { await removeCommercialTeamMember({ data: { userId: m.id } }); toast.success("Removido da equipa."); refresh(); } catch (e) { toast.error((e as Error).message); }
  }

  return <div className="commercial-enter">
    <div className="mb-10 flex items-center justify-between border-b border-border pb-4 text-xs text-muted-foreground"><span>Comercial / Equipa</span><span>MM Club</span></div>
    <div className="commercial-team-layout">
      <header className="commercial-team-intro"><p className="mb-5 text-xs font-medium text-commercial-accent">EQUIPA COMERCIAL</p><h1 className="commercial-page-heading">A nossa equipa</h1><p className="mt-5 max-w-xs text-sm leading-7 text-muted-foreground">SDR e closers do MM Club.</p><div className="mt-8 h-px w-12 bg-commercial-accent" />
        {isAdmin && <Button className="mt-8" onClick={() => setAdding(true)}><Plus /> Adicionar colaborador</Button>}
      </header>
      <div className="commercial-stagger grid gap-6 sm:grid-cols-2">{data.map(m => { const photo = m.photo ?? fallbackPhoto(m.name); return <article key={m.id} className="commercial-person overflow-hidden rounded-lg border border-border bg-card">
        <div className="commercial-person-photo flex items-center justify-center overflow-hidden bg-muted">{photo ? <img src={photo} alt={m.name || "Membro da equipa"} className="h-full w-full object-cover" /> : <span className="text-6xl font-semibold text-muted-foreground">{(m.name || "M").slice(0, 1)}</span>}</div>
        <div className="flex items-center justify-between gap-3 p-6"><div><p className="mb-2 text-xs font-medium text-commercial-accent">{roleLabel(m.role)}</p><h2 className="text-lg font-semibold">{m.name || "Membro MM"}</h2>{isAdmin && <p className="text-xs text-muted-foreground">{m.email}</p>}</div>
          {isAdmin && <div className="flex gap-1"><Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEditing(m)}><Pencil /></Button><Button size="icon" variant="ghost" aria-label="Remover" onClick={() => remove(m)}><Trash2 /></Button></div>}
        </div></article>; })}</div>
    </div>
    {isAdmin && <AddDialog open={adding} onClose={() => setAdding(false)} onDone={refresh} />}
    {isAdmin && editing && <EditDialog member={editing} onClose={() => setEditing(null)} onDone={refresh} />}
  </div>;
}

function RoleSelect({ value, onChange }: { value: string; onChange: (v: "sdr" | "closer") => void }) {
  return <select value={value} onChange={e => onChange(e.target.value as "sdr" | "closer")} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="sdr">SDR</option><option value="closer">Closer</option></select>;
}

function AddDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState(""); const [role, setRole] = useState<"sdr" | "closer">("sdr"); const [busy, setBusy] = useState(false);
  async function save() { setBusy(true); try { await addCommercialTeamMember({ data: { email, role } }); toast.success("Colaborador adicionado."); onDone(); onClose(); setEmail(""); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } }
  return <Dialog open={open} onOpenChange={o => !o && onClose()}><DialogContent><DialogHeader><DialogTitle>Adicionar colaborador</DialogTitle></DialogHeader>
    <div className="space-y-4"><div className="space-y-2"><Label>Email da conta MM Club</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div><div className="space-y-2"><Label>Cargo</Label><RoleSelect value={role} onChange={setRole} /></div></div>
    <DialogFooter><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={busy || !email} onClick={save}>{busy ? "A guardar…" : "Adicionar"}</Button></DialogFooter></DialogContent></Dialog>;
}

function EditDialog({ member, onClose, onDone }: { member: Member; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(member.name ?? ""); const [role, setRole] = useState<"sdr" | "closer">(member.role); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  async function save() {
    if (file && file.size > 3_000_000) return toast.error("Foto demasiado grande (máx. 3 MB).");
    setBusy(true);
    try {
      const photo = file ? { base64: await fileToBase64(file), type: file.type as "image/jpeg" | "image/png" | "image/webp" } : undefined;
      await updateCommercialTeamMember({ data: { userId: member.id, name, role, ...(photo ? { photo } : {}) } });
      toast.success("Alterações guardadas."); onDone(); onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={o => !o && onClose()}><DialogContent><DialogHeader><DialogTitle>Editar colaborador</DialogTitle></DialogHeader>
    <div className="space-y-4"><div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} /></div><div className="space-y-2"><Label>Cargo</Label><RoleSelect value={role} onChange={setRole} /></div><div className="space-y-2"><Label>Foto (JPG, PNG ou WEBP, até 3 MB)</Label><Input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} /></div></div>
    <DialogFooter><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={busy || name.trim().length < 2} onClick={save}>{busy ? "A guardar…" : "Guardar"}</Button></DialogFooter></DialogContent></Dialog>;
}
