import type { Course } from "./types";
import marcaMilionariaCover from "@/assets/marca-milionaria-cover.png.asset.json";

const gradients = {
  gold: "linear-gradient(135deg, oklch(0.82 0.13 82), oklch(0.35 0.08 60))",
  night: "linear-gradient(135deg, oklch(0.22 0.02 260), oklch(0.11 0.01 260))",
  ember: "linear-gradient(135deg, oklch(0.55 0.15 40), oklch(0.18 0.04 40))",
  jade: "linear-gradient(135deg, oklch(0.55 0.12 180), oklch(0.15 0.03 200))",
  rose: "linear-gradient(135deg, oklch(0.55 0.14 350), oklch(0.18 0.04 350))",
  amber: "linear-gradient(135deg, oklch(0.7 0.14 65), oklch(0.25 0.05 65))",
};

const defaultLessonModules: Course["modules"] = [
  {
    id: "m1",
    title: "Aulas principais",
    lessons: [
      { id: "l1", title: "Aula 1 — Introdução", duration: "12m", completed: true },
      { id: "l2", title: "Aula 2 — Método passo a passo", duration: "18m" },
      { id: "l3", title: "Aula 3 — Aplicação prática", duration: "15m" },
    ],
  },
];

export const courses: Course[] = [
  {
    id: "marca-milionaria",
    title: "Marca Milionária",
    tagline: "O método completo de posicionamento premium.",
    description:
      "O curso-mãe do ecossistema. Constrói uma marca com alto valor percebido, do posicionamento à monetização.",
    objectiveId: "criar-negocio",
    expertId: "founder",
    duration: "6h 40m",
    lessonsCount: 28,
    progress: 0.42,
    visibility: "club",
    cover: gradients.gold,
    modules: [
      {
        id: "m1",
        title: "Fundamentos da marca premium",
        lessons: [
          { id: "l1", title: "O que é valor percebido", duration: "12m", completed: true },
          { id: "l2", title: "Anatomia de uma marca milionária", duration: "18m", completed: true },
          { id: "l3", title: "Posicionamento por contraste", duration: "15m", completed: true },
        ],
      },
      {
        id: "m2",
        title: "Construção da narrativa",
        lessons: [
          { id: "l4", title: "Storytelling fundacional", duration: "22m", completed: true },
          { id: "l5", title: "Manifesto de marca", duration: "16m" },
          { id: "l6", title: "Voz e tom", duration: "14m" },
        ],
      },
      {
        id: "m3",
        title: "Monetização",
        lessons: [
          { id: "l7", title: "Escada de valor", duration: "20m" },
          { id: "l8", title: "Pricing premium", duration: "18m" },
        ],
      },
    ],
  },
  {
    id: "milionario-com-ia",
    title: "Milionário com IA",
    tagline: "Como usar IA para escalar o teu negócio.",
    description:
      "Sistema completo para alavancar operações, marketing e delivery com inteligência artificial.",
    objectiveId: "ia",
    expertId: "founder",
    duration: "5h 10m",
    lessonsCount: 22,
    progress: 0.15,
    visibility: "club",
    cover: gradients.jade,
    modules: [
      {
        id: "m1",
        title: "Mentalidade IA-first",
        lessons: [
          { id: "l1", title: "O novo empreendedor", duration: "14m", completed: true },
          { id: "l2", title: "Onde a IA cria alavanca", duration: "16m", completed: true },
          { id: "l3", title: "Stack essencial", duration: "18m" },
        ],
      },
      {
        id: "m2",
        title: "IA em Marketing",
        lessons: [
          { id: "l4", title: "Copy assistida por IA", duration: "20m" },
          { id: "l5", title: "Criativos automáticos", duration: "22m" },
        ],
      },
    ],
  },
  {
    id: "copy-que-converte",
    title: "Copy que Converte",
    tagline: "Escrita de resposta direta para marcas premium.",
    description:
      "Do headline ao close: frameworks de copy que combinam conversão imediata com construção de marca.",
    objectiveId: "marketing",
    expertId: "sofia",
    duration: "3h 50m",
    lessonsCount: 18,
    progress: 0.68,
    visibility: "club",
    cover: gradients.amber,
    modules: defaultLessonModules,
  },
  {
    id: "google-ads-essencial",
    title: "Google Ads Essencial",
    tagline: "Aquisição consistente com intenção de compra.",
    description:
      "Como estruturar campanhas Google que geram vendas todos os dias, mesmo em nichos concorridos.",
    objectiveId: "marketing",
    expertId: "brenda",
    duration: "4h 05m",
    lessonsCount: 20,
    progress: 0,
    visibility: "club",
    cover: gradients.night,
    modules: defaultLessonModules,
  },
  {
    id: "processos-que-escalam",
    title: "Processos que Escalam",
    tagline: "SOPs, delegação e operações leves.",
    description:
      "Como documentar o teu negócio para tirar-te do centro sem perder qualidade.",
    objectiveId: "escalar",
    expertId: "edmar",
    duration: "3h 15m",
    lessonsCount: 16,
    progress: 0.22,
    visibility: "club",
    cover: gradients.ember,
    modules: defaultLessonModules,
  },
  {
    id: "lideranca-fundadores",
    title: "Liderança para Fundadores",
    tagline: "Construir equipa antes que ela te construa.",
    description:
      "Frameworks de contratação, feedback e cultura para empresas em crescimento acelerado.",
    objectiveId: "lideranca-performance",
    expertId: "rui",
    duration: "4h 30m",
    lessonsCount: 24,
    progress: 0,
    visibility: "club",
    cover: gradients.night,
    modules: defaultLessonModules,
  },
  {
    id: "produtividade-founder",
    title: "Produtividade do Founder",
    tagline: "Sistema semanal de foco e execução.",
    description:
      "Como priorizar, delegar e proteger o tempo de decisão que só o fundador pode tomar.",
    objectiveId: "lideranca-performance",
    expertId: "rui",
    duration: "2h 20m",
    lessonsCount: 12,
    progress: 0.05,
    visibility: "club",
    cover: gradients.rose,
    modules: defaultLessonModules,
  },
  {
    id: "prompt-engineering-club",
    title: "Prompt Engineering para Empreendedores",
    tagline: "Prompts que produzem resultado de negócio.",
    description:
      "Padrões de prompt para copy, análise, operações e delivery. Foco em resultado, não em teoria.",
    objectiveId: "ia",
    expertId: "founder",
    duration: "2h 40m",
    lessonsCount: 14,
    progress: 0,
    visibility: "club",
    cover: gradients.jade,
    modules: defaultLessonModules,
  },

  // ─── Em breve ───────────────────────────────────────────────
  {
    id: "meta-ads-brenda",
    title: "Meta Ads",
    tagline: "Aquisição paga em escala com Brenda.",
    description: "Novo curso completo de Meta Ads com a Brenda.",
    objectiveId: "marketing",
    expertId: "brenda",
    duration: "—",
    lessonsCount: 0,
    progress: 0,
    visibility: "club",
    cover: gradients.ember,
    status: "coming-soon",
    releaseLabel: "Disponível em breve",
  },
  {
    id: "agencia-ia-edmar",
    title: "Agência IA",
    tagline: "Constrói uma agência moderna com Edmar.",
    description: "Método completo de agência IA, do primeiro cliente à operação escalável.",
    objectiveId: "escalar",
    expertId: "edmar",
    duration: "—",
    lessonsCount: 0,
    progress: 0,
    visibility: "club",
    cover: gradients.jade,
    status: "coming-soon",
    releaseLabel: "Disponível em breve",
  },
  {
    id: "dropshipping-latam-dieisy",
    title: "Dropshipping LATAM",
    tagline: "E-commerce em mercados latinos com Dieisy.",
    description: "Sourcing, criativos e logística para dropshipping em LATAM.",
    objectiveId: "criar-negocio",
    expertId: "dieisy",
    duration: "—",
    lessonsCount: 0,
    progress: 0,
    visibility: "club",
    cover: gradients.rose,
    status: "coming-soon",
    releaseLabel: "Disponível em breve",
  },
];

export const coursesById = Object.fromEntries(courses.map((c) => [c.id, c]));

export const liveCourses = courses.filter((c) => c.status !== "coming-soon");
export const upcomingCourses = courses.filter((c) => c.status === "coming-soon");
