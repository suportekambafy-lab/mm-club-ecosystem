import guadalupe from "@/assets/guadalupe-costa.jpg.asset.json";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function TeamProfile({ link = false }: { link?: boolean }) {
  return <article className="commercial-person group overflow-hidden rounded-lg border border-border bg-card">
    <div className="commercial-person-photo overflow-hidden"><img src={guadalupe.url} alt="Guadalupe Costa" className="h-full w-full object-cover" /></div>
    <div className="flex items-center justify-between gap-3 p-6"><div><p className="mb-2 text-xs font-medium text-commercial-accent">Closer</p><h3 className="text-lg font-semibold">Guadalupe Costa</h3></div>{link && <Button asChild variant="ghost" size="icon"><Link to="/comercial/equipa" aria-label="Ver equipa"><ArrowUpRight /></Link></Button>}</div>
  </article>;
}
