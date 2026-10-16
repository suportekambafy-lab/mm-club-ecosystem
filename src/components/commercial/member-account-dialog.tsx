import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createPlatformMember, updatePlatformMember, deletePlatformMember } from "@/lib/commercial/members.functions";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Save, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { memberDetailsSchema } from "@/lib/commercial/member-rules";
import { AccessDurationPicker } from "./access-duration-picker";
import type { AccessDuration } from "@/lib/commercial/rules";
export type AccountDialogState = { mode: "create" } | { mode: "edit" | "delete"; member: { id: string; display_name: string | null; email: string | null } };
export function MemberAccountDialog({ state, onClose, onSaved }: { state: AccountDialogState; onClose: () => void; onSaved: () => Promise<void> }) {
 const member = state.mode === "create" ? null : state.member;
 const [name, setName] = useState(member?.display_name ?? "");
 const [email, setEmail] = useState(member?.email ?? "");
 const [confirmation, setConfirmation] = useState("");
 const [months, setMonths] = useState<AccessDuration>(1);
 const [busy, setBusy] = useState(false);
 const create = useServerFn(createPlatformMember); const update = useServerFn(updatePlatformMember); const remove = useServerFn(deletePlatformMember);
 const deleting = state.mode === "delete";
 async function submit(e: React.FormEvent) {
  e.preventDefault();
  if (!deleting && !memberDetailsSchema.safeParse({name,email}).success) return toast.error("Indica um nome e email válidos.");
  setBusy(true);
  try {
   if (state.mode === "create") await create({data:{name,email,months}});
   else if (state.mode === "edit") await update({data:{userId:state.member.id,name,email}});
   else { if (confirmation !== "ELIMINAR") return; await remove({data:{userId:state.member.id,confirmation:"ELIMINAR"}}); }
   toast.success(deleting ? "Utilizador eliminado." : state.mode === "create" ? "Utilizador criado com acesso. Convite enviado por email." : "Dados atualizados.");
   await onSaved(); onClose();
  } catch(e) { toast.error(e instanceof Error ? e.message : "Não foi possível guardar."); } finally {setBusy(false);}
 }
 return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent aria-describedby={undefined} className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-lg text-foreground"><DialogTitle className="pr-6 text-xl font-semibold">{deleting ? "Eliminar utilizador" : state.mode === "create" ? "Novo utilizador" : "Corrigir utilizador"}</DialogTitle>
 <form onSubmit={submit} className="mt-6 space-y-5">{deleting ? <><p className="break-words text-sm text-muted-foreground">Eliminar a conta de <strong className="text-foreground">{name || email}</strong>? Esta ação não pode ser desfeita. Não cancela cobranças no processador de pagamentos.</p><label className="block text-sm">Escreve ELIMINAR para confirmar<input aria-label="Confirmação de eliminação" value={confirmation} onChange={e=>setConfirmation(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-border bg-muted px-3" /></label></> : <><label className="block text-sm">Nome<input aria-label="Nome do utilizador" required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-border bg-muted px-3" /></label><label className="block text-sm">Email<input aria-label="Email do utilizador" required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-border bg-muted px-3" /></label>{state.mode === "create" && <><AccessDurationPicker value={months} onChange={setMonths} disabled={busy} /><p className="text-xs text-muted-foreground">Recebe um convite por email para definir a palavra-passe. O acesso começa agora e termina automaticamente no prazo escolhido; vitalício não expira.</p></>}</>}
 <Button type="submit" disabled={busy || (deleting && confirmation!=="ELIMINAR")} variant={deleting ? "destructive" : "default"} className="w-full">{busy ? <Loader2 className="animate-spin" /> : deleting ? <Trash2 /> : state.mode === "create" ? <UserPlus /> : <Save />}{deleting ? "Eliminar definitivamente" : state.mode === "create" ? "Criar e enviar convite" : "Guardar alterações"}</Button></form></DialogContent></Dialog>;
}
