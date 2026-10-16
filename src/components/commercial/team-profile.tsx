import guadalupe from "@/assets/guadalupe-costa.jpg.asset.json";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function TeamProfile({ link = false }: { link?: boolean }) {
  return <article className="commercial-person group overflow-hidden rounded-lg border border-border bg-card">
    <div className="relative aspect-[4/3] overflow-hidden"><img src={guadalupe.url} alt="Guadalupe Costa" className="h-full w-full object-cover object-[center_30%] transition-transform duration-700 group-hover:scale-105" /><span className="absolute left-4 top-4 rounded-md bg-background/90 px-3 py-1.5 text-xs font-medium text-commercial-gold">MM TEAM</span></div>
    <div className="flex items-center justify-between gap-3 p-5"><div><p className="mb-1 text-xs font-medium text-commercial-gold">CLOSER</p><h3 className="text-xl font-semibold">Guadalupe Costa</h3></div>{link && <Button asChild variant="outline" size="icon"><Link to="/comercial/equipa" aria-label="Ver equipa"><ArrowUpRight /></Link></Button>}</div>
  </article>;
}
