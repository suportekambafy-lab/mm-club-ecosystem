import type { Live } from "./types";

const now = Date.now();
const day = 86400000;

export const lives: Live[] = [
  {
    id: "live-1",
    title: "Como estruturar uma oferta irresistível em 60 minutos",
    expertId: "founder",
    startsAt: new Date(now + 2 * day + 3600000 * 3).toISOString(),
    duration: "60m",
    visibility: "club",
    cover: "linear-gradient(135deg, oklch(0.82 0.13 82), oklch(0.25 0.05 60))",
  },
  {
    id: "live-2",
    title: "Meta Ads: os 5 criativos que estão a escalar em 2026",
    expertId: "brenda",
    startsAt: new Date(now + 7 * day).toISOString(),
    duration: "75m",
    visibility: "club",
    cover: "linear-gradient(135deg, oklch(0.5 0.15 30), oklch(0.15 0.03 30))",
  },
  {
    id: "live-3",
    title: "Agência IA: do primeiro cliente aos €30k/mês",
    expertId: "edmar",
    startsAt: new Date(now + 14 * day).toISOString(),
    duration: "90m",
    visibility: "club",
    cover: "linear-gradient(135deg, oklch(0.5 0.12 200), oklch(0.15 0.03 200))",
  },
  // gravadas
  {
    id: "live-r1",
    title: "Copywriting premium — sessão aberta",
    expertId: "sofia",
    startsAt: new Date(now - 8 * day).toISOString(),
    duration: "68m",
    visibility: "club",
    cover: "linear-gradient(135deg, oklch(0.6 0.14 90), oklch(0.2 0.04 90))",
    recording: true,
  },
  {
    id: "live-r2",
    title: "IA na operação: automatizar sem perder qualidade",
    expertId: "founder",
    startsAt: new Date(now - 21 * day).toISOString(),
    duration: "82m",
    visibility: "club",
    cover: "linear-gradient(135deg, oklch(0.55 0.12 180), oklch(0.15 0.03 200))",
    recording: true,
  },
  {
    id: "live-r3",
    title: "Liderança para founders — Q&A",
    expertId: "rui",
    startsAt: new Date(now - 30 * day).toISOString(),
    duration: "55m",
    visibility: "club",
    cover: "linear-gradient(135deg, oklch(0.4 0.06 260), oklch(0.14 0.02 260))",
    recording: true,
  },
];

export const upcomingLives = lives
  .filter((l) => !l.recording)
  .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

export const pastLives = lives
  .filter((l) => l.recording)
  .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));

export const nextLive = upcomingLives[0];
