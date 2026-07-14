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
    cover: `url(${marcaMilionariaCover.url}) center/cover no-repeat, #000`,
    logo: marcaMilionariaCover.url,
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
];

export const coursesById = Object.fromEntries(courses.map((c) => [c.id, c]));

export const liveCourses = courses.filter((c) => c.status !== "coming-soon");
export const upcomingCourses = courses.filter((c) => c.status === "coming-soon");
