import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { getClubAccessState } from "@/lib/entitlements/access.functions";
import { resolveAccessState } from "@/lib/entitlements/access-state";

export function useClubAccessExpiry(userId: string) {
 const read = useServerFn(getClubAccessState);
 const query = useQuery({queryKey:["club-access-expiry",userId],queryFn:()=>read(),refetchInterval:30000,refetchOnWindowFocus:"always",staleTime:0});
 const [now,setNow] = useState(Date.now());
 const snapshot = query.data;
 const offset = snapshot ? snapshot.serverNow - query.dataUpdatedAt : 0;
 const state = snapshot ? resolveAccessState(snapshot.grants,now + offset) : null;
 useEffect(() => {
  setNow(Date.now());
  const tick = () => setNow(Date.now());
  const interval = window.setInterval(tick,1000);
  window.addEventListener("focus",tick);
  document.addEventListener("visibilitychange",tick);
  return () => {window.clearInterval(interval);window.removeEventListener("focus",tick);document.removeEventListener("visibilitychange",tick);};
 },[snapshot]);
 return snapshot?.isAdmin ? {hasAccess:true,manual:false,expired:false,expiresAt:null} : state;
}

export function AccessExpiryBanner({expired,expiresAt}:{expired:boolean;expiresAt:string|null}) {
 return <div role="status" className="mb-4 flex flex-col gap-3 border border-border bg-muted px-4 py-4 text-foreground sm:flex-row sm:items-center"><CalendarClock className="h-5 w-5 shrink-0 text-primary"/><div className="min-w-0 flex-1 text-sm"><strong>{expired ? "O teu acesso terminou." : "Acesso ao MM Club"}</strong><p className="mt-1 text-muted-foreground">{expired ? "As aulas, lives e restantes conteúdos reservados estão bloqueados. O teu progresso continua guardado." : expiresAt ? `Válido até ${new Date(expiresAt).toLocaleString("pt-PT")}.` : "Vitalício — sem data de fim."}</p></div>{expired && <Link to="/subscricao" className="font-semibold text-primary underline underline-offset-4">Renovar acesso</Link>}</div>;
}