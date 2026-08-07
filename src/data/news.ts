import type { NewsItem } from "./types";

export const news: NewsItem[] = [
  {
    id: "n1",
    type: "course",
    title: "Novo curso: Prompt Engineering para Empreendedores",
    subtitle: "Marca Milionária",
    timeAgo: "há 2 dias",
    href: "/academia/prompt-engineering-club",
  },
  {
    id: "n2",
    type: "expert",
    title: "Nova especialista no clube: Brenda",
    subtitle: "Meta Ads · Aquisição",
    timeAgo: "há 3 dias",
    href: "/especialistas/brenda",
  },
  {
    id: "n3",
    type: "live",
    title: "Live marcada: Oferta irresistível em 60 minutos",
    subtitle: "Com o fundador · esta semana",
    timeAgo: "há 4 dias",
    href: "/lives",
  },
  {
    id: "n4",
    type: "tool",
    title: "Nova ferramenta: Calculadora de pricing premium",
    subtitle: "Ferramentas · Calculadoras",
    timeAgo: "há 5 dias",
    href: "/ferramentas",
  },
  {
    id: "n5",
    type: "jade",
    title: "MM Inteligente atualizada com o método Marca Milionária",
    subtitle: "Base de conhecimento expandida",
    timeAgo: "há 6 dias",
    href: "/jade",
  },
  {
    id: "n6",
    type: "course",
    title: "Meta Ads com Brenda em breve no MM Club",
    subtitle: "Marketing",
    timeAgo: "há 1 semana",
    href: "/academia",
  },
];
