import type { EventItem } from "./types";

export const events: EventItem[] = [
  {
    id: "mm-summit-2026",
    title: "MM Summit 2026",
    type: "Summit",
    date: "12–14 Maio 2026",
    location: "Lisboa · Portugal",
    visibility: "premium",
    description:
      "Três dias com a comunidade MM. Palcos de estratégia, IA e escala, com jantares e networking privado.",
    cover: "linear-gradient(135deg, oklch(0.82 0.13 82), oklch(0.2 0.04 60))",
  },
  {
    id: "masterclass-copy",
    title: "Masterclass: Copy Premium",
    type: "Masterclass",
    date: "28 Fevereiro 2026",
    location: "Online · ao vivo",
    visibility: "club",
    description: "Sessão profunda com a Sofia sobre copy de resposta direta para marcas premium.",
    cover: "linear-gradient(135deg, oklch(0.55 0.14 90), oklch(0.18 0.04 90))",
  },
  {
    id: "networking-porto",
    title: "MM Networking · Porto",
    type: "Networking",
    date: "20 Março 2026",
    location: "Porto · Portugal",
    visibility: "club",
    description: "Jantar privado com membros do MM Club na Invicta.",
    cover: "linear-gradient(135deg, oklch(0.4 0.08 260), oklch(0.15 0.03 260))",
  },
  {
    id: "presencial-ia",
    title: "MM IA Day",
    type: "Presencial",
    date: "18 Abril 2026",
    location: "Lisboa · Portugal",
    visibility: "premium",
    description: "Um dia inteiro dedicado a implementação prática de IA no negócio.",
    cover: "linear-gradient(135deg, oklch(0.55 0.12 180), oklch(0.15 0.03 200))",
  },
];

export const upcomingEvents = events;
