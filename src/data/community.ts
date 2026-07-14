import type { CommunityNotice } from "./types";

export const communityNotices: CommunityNotice[] = [
  {
    id: "c1",
    title: "Grupo WhatsApp aberto para novos membros",
    body: "Junta-te ao grupo privado. Debates diários, avisos de lives e networking.",
    timeAgo: "hoje",
  },
  {
    id: "c2",
    title: "MM Summit — inscrições early bird abertas",
    body: "Vagas limitadas para membros MM Club. Prioridade sobre lista pública.",
    timeAgo: "há 2 dias",
  },
  {
    id: "c3",
    title: "Q&A com o fundador — Quinta às 21h",
    body: "Traz as tuas perguntas. Sessão exclusiva para membros ativos.",
    timeAgo: "há 3 dias",
  },
];

export const featuredMembers = [
  { name: "André M.", role: "Agência de tráfego · Porto", initials: "AM" },
  { name: "Cátia S.", role: "E-commerce · Braga", initials: "CS" },
  { name: "Rafael T.", role: "Consultoria IA · Lisboa", initials: "RT" },
  { name: "Marta P.", role: "SaaS · Coimbra", initials: "MP" },
];
