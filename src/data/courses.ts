import type { Course } from "./types";
import lessonL1 from "@/assets/lesson-l1.jpg";
import lessonL2 from "@/assets/lesson-l2.jpg";
import lessonL3 from "@/assets/lesson-l3.jpg";
import lessonL4 from "@/assets/lesson-l4.jpg";
import lessonL5 from "@/assets/lesson-l5.jpg";
import lessonL6 from "@/assets/lesson-l6.jpg";
import lessonL7 from "@/assets/lesson-l7.jpg";
import lessonL8 from "@/assets/lesson-l8.jpg";


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
          { id: "l1", title: "O que é valor percebido", duration: "12m", completed: true, cover: lessonL1 },
          { id: "l2", title: "Anatomia de uma marca milionária", duration: "18m", completed: true, cover: lessonL2 },
          { id: "l3", title: "Posicionamento por contraste", duration: "15m", completed: true, cover: lessonL3 },
        ],
      },
      {
        id: "m2",
        title: "Construção da narrativa",
        lessons: [
          { id: "l4", title: "Storytelling fundacional", duration: "22m", completed: true, cover: lessonL4 },
          { id: "l5", title: "Manifesto de marca", duration: "16m", cover: lessonL5 },
          { id: "l6", title: "Voz e tom", duration: "14m", cover: lessonL6 },
        ],
      },
      {
        id: "m3",
        title: "Monetização",
        lessons: [
          { id: "l7", title: "Escada de valor", duration: "20m", cover: lessonL7 },
          { id: "l8", title: "Pricing premium", duration: "18m", cover: lessonL8 },
        ],
      },
    ],
  },
];

export const coursesById = Object.fromEntries(courses.map((c) => [c.id, c]));

export const liveCourses = courses.filter((c) => c.status !== "coming-soon");
export const upcomingCourses = courses.filter((c) => c.status === "coming-soon");
