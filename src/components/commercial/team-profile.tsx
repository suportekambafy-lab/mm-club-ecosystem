import guadalupe from "@/assets/guadalupe-costa.jpg.asset.json";
import victor from "@/assets/victor-muabi.jpg.asset.json";
import elizangela from "@/assets/elizangela-dos-santos.png.asset.json";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const FEATURED_TEAM = [
  { name: "Victor Muabi", title: "Fundador", photo: victor.url, match: "victor" },
  { name: "Guadalupe Costa", title: "Closer", photo: guadalupe.url, match: "guadalupe" },
  { name: "Elizângela dos Santos", title: "SDR", photo: elizangela.url, match: "elizângela" },
];

export function TeamProfile({ link = false }: { link?: boolean }) {
  return <>{FEATURED_TEAM.map(person => <article key={person.name} className="commercial-person group overflow-hidden rounded-lg border border-border bg-card">
    <div className="commercial-person-photo overflow-hidden"><img src={person.photo} alt={person.name} className="h-full w-full object-cover" /></div>
    <div className="flex items-center justify-between gap-3 p-6"><div><p className="mb-2 text-xs font-medium text-commercial-accent">{person.title}</p><h3 className="text-lg font-semibold">{person.name}</h3></div>{link && <Button asChild variant="ghost" size="icon"><Link to="/comercial/equipa" aria-label="Ver equipa"><ArrowUpRight /></Link></Button>}</div>
  </article>)}</>;
}
