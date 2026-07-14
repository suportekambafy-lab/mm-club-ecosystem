import { courses } from "@/data/courses";
import { experts } from "@/data/experts";
import { tools } from "@/data/tools";
import { lives } from "@/data/lives";
import { events } from "@/data/events";

export type SearchType = "course" | "expert" | "tool" | "live" | "event";

export interface SearchItem {
  id: string;
  type: SearchType;
  title: string;
  subtitle: string;
  href: string;
  keywords: string;
}

export function buildSearchIndex(): SearchItem[] {
  const items: SearchItem[] = [];

  for (const c of courses) {
    items.push({
      id: `course:${c.id}`,
      type: "course",
      title: c.title,
      subtitle: c.tagline,
      href: `/academia/${c.id}`,
      keywords: `${c.title} ${c.tagline} ${c.description} ${c.objectiveId}`.toLowerCase(),
    });
  }
  for (const e of experts) {
    items.push({
      id: `expert:${e.id}`,
      type: "expert",
      title: e.name,
      subtitle: e.role,
      href: `/especialistas/${e.id}`,
      keywords: `${e.name} ${e.role} ${e.expertise.join(" ")}`.toLowerCase(),
    });
  }
  for (const t of tools) {
    items.push({
      id: `tool:${t.id}`,
      type: "tool",
      title: t.title,
      subtitle: t.category,
      href: `/ferramentas`,
      keywords: `${t.title} ${t.description} ${t.category}`.toLowerCase(),
    });
  }
  for (const l of lives) {
    items.push({
      id: `live:${l.id}`,
      type: "live",
      title: l.title,
      subtitle: l.recording ? "Live gravada" : "Próxima live",
      href: `/lives`,
      keywords: `${l.title} live`.toLowerCase(),
    });
  }
  for (const ev of events) {
    items.push({
      id: `event:${ev.id}`,
      type: "event",
      title: ev.title,
      subtitle: `${ev.type} · ${ev.date}`,
      href: `/eventos`,
      keywords: `${ev.title} ${ev.type} ${ev.location}`.toLowerCase(),
    });
  }

  return items;
}

export function searchLabel(type: SearchType): string {
  switch (type) {
    case "course":
      return "Cursos";
    case "expert":
      return "Especialistas";
    case "tool":
      return "Ferramentas";
    case "live":
      return "Lives";
    case "event":
      return "Eventos";
  }
}
