import type { Expert } from "./types";
import marcaMilionariaCover from "@/assets/marca-milionaria-cover.png.asset.json";

export const experts: Expert[] = [
  {
    id: "founder",
    name: "Marca Milionária",
    role: "Fundador · Estratégia",
    photo: "linear-gradient(135deg, oklch(0.35 0.08 60), oklch(0.15 0.02 60))",
    logo: marcaMilionariaCover.url,
    shortBio: "Fundador da Marca Milionária. Estratégia de marca e escala.",
    longBio:
      "Fundador da Marca Milionária, ajudou milhares de empreendedores a construir marcas de alto valor percebido. Aqui partilha o método completo de posicionamento e escala.",
    expertise: ["Marca", "Posicionamento", "Escala"],
  },
  {
    id: "jade",
    name: "MM Inteligente",
    role: "IA nativa do MM Club",
    photo: "linear-gradient(135deg, oklch(0.82 0.13 82), oklch(0.55 0.12 60))",
    shortBio: "A inteligência do clube. Treinada com a base de conhecimento MM.",
    longBio:
      "MM Inteligente é a IA nativa do MM Club. Responde com base exclusiva no conhecimento produzido pela marca — cursos, playbooks e livraria de prompts.",
    expertise: ["IA aplicada", "Copy", "Estratégia"],
  },
  {
    id: "brenda",
    name: "Brenda",
    role: "Meta Ads · Aquisição",
    photo: "linear-gradient(135deg, oklch(0.4 0.1 30), oklch(0.18 0.03 30))",
    shortBio: "Especialista em Meta Ads e aquisição paga.",
    longBio:
      "Gestora de milhões em investimento em Meta Ads. Ensina estruturas de campanha e criativos que convertem em nichos competitivos.",
    expertise: ["Meta Ads", "Criativos", "Escala"],
  },
  {
    id: "edmar",
    name: "Edmar",
    role: "Agência IA · Operações",
    photo: "linear-gradient(135deg, oklch(0.42 0.09 200), oklch(0.18 0.03 200))",
    shortBio: "Constrói agências alavancadas por IA.",
    longBio:
      "Especialista em operações e delivery. Ensina como montar uma agência moderna com IA no centro do processo.",
    expertise: ["Operações", "IA", "Delivery"],
  },
  {
    id: "dieisy",
    name: "Dieisy",
    role: "Dropshipping LATAM",
    photo: "linear-gradient(135deg, oklch(0.45 0.12 340), oklch(0.18 0.03 340))",
    shortBio: "E-commerce e dropshipping em mercados LATAM.",
    longBio:
      "Referência em dropshipping LATAM. Método completo de sourcing, criativos e logística para o mercado latino.",
    expertise: ["E-commerce", "LATAM", "Sourcing"],
  },
  {
    id: "sofia",
    name: "Sofia",
    role: "Copywriting · Conversão",
    photo: "linear-gradient(135deg, oklch(0.5 0.1 90), oklch(0.2 0.03 90))",
    shortBio: "Copywriting de resposta direta e storytelling de marca.",
    longBio:
      "Escreve para marcas premium há mais de uma década. Especialista em copy que combina conversão e marca.",
    expertise: ["Copy", "Storytelling", "Marca"],
  },
  {
    id: "rui",
    name: "Rui",
    role: "Liderança · Equipas",
    photo: "linear-gradient(135deg, oklch(0.4 0.06 260), oklch(0.16 0.02 260))",
    shortBio: "Constrói equipas de alto desempenho.",
    longBio:
      "Consultor de liderança para founders. Frameworks de contratação, delegação e cultura em empresas em escala.",
    expertise: ["Liderança", "Cultura", "Delegação"],
  },
];

export const expertsById = Object.fromEntries(experts.map((e) => [e.id, e]));
