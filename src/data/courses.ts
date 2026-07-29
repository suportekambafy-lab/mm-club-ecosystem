import type { Course } from "./types";
import lessonL1 from "@/assets/lesson-l1.jpg";
import lessonL2 from "@/assets/lesson-l2.jpg";
import lessonL3 from "@/assets/lesson-l3.jpg";
import lessonL4 from "@/assets/lesson-l4.jpg";
import lessonL5 from "@/assets/lesson-l5.jpg";
import lessonL6 from "@/assets/lesson-l6.jpg";
import lessonL7 from "@/assets/lesson-l7.jpg";
import lessonL8 from "@/assets/lesson-l8.jpg";

// Conteúdo real do curso (fonte: administração). NÃO adicionar aulas de
// demonstração aqui — o que estiver neste ficheiro é o que os membros veem
// antes de os overrides do admin carregarem.

const COURSE_COVER = "https://yarjxrbhxaawzdizmvlh.supabase.co/storage/v1/object/sign/course-media/courses/marca-milionaria/logo/1785064506187-bze4qr.PNG?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV81YTA0ZWZiOS0yZmMzLTQxZGQtYjkzYi1jNWRiMzQzNzllOTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjb3Vyc2UtbWVkaWEvY291cnNlcy9tYXJjYS1taWxpb25hcmlhL2xvZ28vMTc4NTA2NDUwNjE4Ny1iemU0cXIuUE5HIiwic2NvcGUiOiJkb3dubG9hZCIsImlhdCI6MTc4NTA2NDUwNiwiZXhwIjoyMTAwNDI0NTA2fQ.psHSZ9Fo80xUEpFR4Ml-omo86qb4PgVMcH-pEvggoIg";
const COURSE_LOGO = "https://yarjxrbhxaawzdizmvlh.supabase.co/storage/v1/object/sign/course-media/courses/marca-milionaria/logo/1785064506187-bze4qr.PNG?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV81YTA0ZWZiOS0yZmMzLTQxZGQtYjkzYi1jNWRiMzQzNzllOTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjb3Vyc2UtbWVkaWEvY291cnNlcy9tYXJjYS1taWxpb25hcmlhL2xvZ28vMTc4NTA2NDUwNjE4Ny1iemU0cXIuUE5HIiwic2NvcGUiOiJkb3dubG9hZCIsImlhdCI6MTc4NTA2NDUwNiwiZXhwIjoyMTAwNDI0NTA2fQ.psHSZ9Fo80xUEpFR4Ml-omo86qb4PgVMcH-pEvggoIg";

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
    lessonsCount: 26,
    progress: 0,
    visibility: "club",
    cover: COURSE_COVER,
    logo: COURSE_LOGO,
    modules: [
  {
    id: "m1",
    title: "BOAS VINDAS",
    lessons: [
        { id: "l1", title: "Seja bem vindo Milionário", duration: "4:12", videoUrl: "https://vz-5c879716-268.b-cdn.net/6d7502b0-6677-460d-8797-f8d98b9cdcf7/playlist.m3u8", cover: lessonL1 },
        { id: "l2", title: "Mentalidade Day One", duration: "5:00", videoUrl: "https://vz-5c879716-268.b-cdn.net/8141d4e5-0b41-40c4-bdf2-1f72aeb37ffe/playlist.m3u8", cover: lessonL2 },
        { id: "l3", title: "A sua jornada", duration: "6:00", videoUrl: "https://vz-5c879716-268.b-cdn.net/801ca5ec-d1af-4b74-a154-4ca52fc7162e/playlist.m3u8", cover: lessonL3 },
    ],
  },
  {
    id: "m3",
    title: "CASH ON DELIVERY",
    lessons: [
        { id: "l7", title: "Conceitos básicos sobre Marting Digital", duration: "1:00", videoUrl: "https://vz-5c879716-268.b-cdn.net/b00e68d4-6792-46e6-9f0f-6baa19bab3f4/playlist.m3u8", cover: lessonL7 },
        { id: "l8", title: "O que é COD e como receber o financiamento", duration: "3:05", videoUrl: "https://vz-5c879716-268.b-cdn.net/3e5ea8e9-7c1b-4112-a173-b3d4e0a233dd/playlist.m3u8", cover: lessonL8 },
        { id: "l-mrt0h7wq", title: "Plataformas de COD", duration: "4:50", videoUrl: "https://vz-5c879716-268.b-cdn.net/4145ad23-7f5f-43a6-a1de-822c07c4b692/playlist.m3u8" },
        { id: "l-mrt0hpzl", title: "Dropi + características de produto vencedor", duration: "18:50", videoUrl: "https://vz-5c879716-268.b-cdn.net/b16c70c6-97a9-4625-9e24-e730ea17ffa4/playlist.m3u8" },
        { id: "l-mrt0ib0i", title: "Como configurar a Dropea e resgatar os 300€", duration: "12:50", videoUrl: "https://vz-5c879716-268.b-cdn.net/a7b48d5d-ffd2-49b8-a9a2-393483888955/playlist.m3u8" },
        { id: "l-mrt0iysm", title: "Tipos de loja", duration: "7:50", videoUrl: "https://vz-5c879716-268.b-cdn.net/97a782dd-e20f-4af1-9a58-ab862922c00f/playlist.m3u8" },
    ],
  },
  {
    id: "m2",
    title: "CONFIGURANDO SUA LOJA",
    lessons: [
        { id: "l4", title: "Criando conta no Shopify", duration: "22m", videoUrl: "https://vz-5c879716-268.b-cdn.net/53804fe3-ef17-430b-990d-fc940d95d3ff/playlist.m3u8", cover: lessonL4 },
        { id: "l5", title: "Conectando fornecedores COD", duration: "16m", videoUrl: "https://vz-5c879716-268.b-cdn.net/a1d2be5d-15b2-4048-a1de-c1b50925cee1/playlist.m3u8", cover: lessonL5 },
        { id: "l6", title: "Estudo de mercado + nicho lucrativos", duration: "14m", videoUrl: "https://vz-5c879716-268.b-cdn.net/6a49a0ec-8840-41a6-ba42-ce721fef6baf/playlist.m3u8", cover: lessonL6 },
        { id: "l-ms3a7r97", title: "Organizando coleções", duration: "11:35", videoUrl: "https://vz-5c879716-268.b-cdn.net/d0a16d25-fcbf-46a4-b72c-f7ae47fdbad6/playlist.m3u8" },
        { id: "l-ms3a9vph", title: "Editando nossa loja", duration: "46:41", videoUrl: "https://vz-5c879716-268.b-cdn.net/028357da-a280-4fe5-b03a-b8c94fc21678/playlist.m3u8" },
        { id: "l-ms3ac7kg", title: "Editando nossa loja PARTE 2", duration: "20:05", videoUrl: "https://vz-5c879716-268.b-cdn.net/0391e673-39b5-4e81-b99d-3eedccb6a6a6/playlist.m3u8" },
        { id: "l-ms3adlru", title: "Aplicativos essenciais", duration: "31:45", videoUrl: "https://vz-5c879716-268.b-cdn.net/b751c65c-bb5b-4aee-91b9-b78078da67bc/playlist.m3u8" },
        { id: "l-ms3af1y4", title: "Comprar e conectar domínio", duration: "9:43", videoUrl: "https://vz-5c879716-268.b-cdn.net/fcf33383-0d92-4d7f-ae7a-a2a4f6fd8001/playlist.m3u8" },
        { id: "l-ms3afgks", title: "Configuando shopify payments", duration: "10:04", videoUrl: "https://vz-5c879716-268.b-cdn.net/5b18cb2d-e383-4ec1-bdd6-0e87117725f4/playlist.m3u8" },
    ],
  },
  {
    id: "m-ms3ait56",
    title: "Tráfego Pago",
    lessons: [
        { id: "l-ms3aj6u7", title: "Introdução a Tráfego pago", duration: "1:12", videoUrl: "https://vz-5c879716-268.b-cdn.net/0e2b58af-bd67-4cbf-8009-ddaa1fc49ca7/playlist.m3u8" },
        { id: "l-ms3akgv5", title: "Criação de Página", duration: "8:49", videoUrl: "https://vz-5c879716-268.b-cdn.net/0de1a216-e91e-4b16-bce3-933dd42dd284/playlist.m3u8" },
        { id: "l-ms3am2kj", title: "Como conectar o instagram a página", duration: "3:44", videoUrl: "https://vz-5c879716-268.b-cdn.net/a84dd96b-4870-4305-a098-e06a7b5bc2c6/playlist.m3u8" },
        { id: "l-ms3an51l", title: "Como criar um Business Manager (BM)", duration: "8:29", videoUrl: "https://vz-5c879716-268.b-cdn.net/11a23b66-1791-4854-850f-468058fccf99/playlist.m3u8" },
        { id: "l-ms3ao5v2", title: "Como configurar pixel", duration: "7:51", videoUrl: "https://vz-5c879716-268.b-cdn.net/defaa095-862d-4171-88f6-1ff7aea748f6/playlist.m3u8" },
        { id: "l-ms3aq3bk", title: "Subindo a primeira campanha", duration: "26:17", videoUrl: "https://vz-5c879716-268.b-cdn.net/d35d2b0d-eab8-4b12-8888-468e1d0c96b5/playlist.m3u8" },
    ],
  },
  {
    id: "m-mrt121z6",
    title: "BONUS",
    lessons: [
        { id: "l-mrt126tt", title: "Tráfego pago com Brenda Percontine", duration: "50:12", videoUrl: "https://vz-5c879716-268.b-cdn.net/857fc23e-2291-42c5-8d93-f2d255c8ca5b/playlist.m3u8" },
        { id: "l-ms1s9y94", title: "Mineração Global O protocolo de elite para encontrar produtos lucrativos - Dieisy ", duration: "2:55:21", videoUrl: "https://vz-5c879716-268.b-cdn.net/cec9abce-c593-4ca8-be49-1a8b9474cf09/playlist.m3u8" },
    ],
  },
    ],
  },
];

export const coursesById = Object.fromEntries(courses.map((c) => [c.id, c]));

export const liveCourses = courses.filter((c) => c.status !== "coming-soon");
export const upcomingCourses = courses.filter((c) => c.status === "coming-soon");
