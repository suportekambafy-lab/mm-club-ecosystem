import type { Course, CurrentUser, DashboardBlockId } from "@/data/types";
import { liveCourses } from "@/data/courses";

// Dashboard personalizável — hoje mock, amanhã vem do backend.
// A UI itera user.dashboard.blocks pela ordem e renderiza o bloco correspondente.

export function continueWatching(_user: CurrentUser): Course[] {
  return liveCourses
    .filter((c) => c.progress > 0 && c.progress < 1)
    .sort((a, b) => b.progress - a.progress);
}

export function recommendedForUser(_user: CurrentUser): Course[] {
  // Mock: cursos sem progresso, ordenados por afinidade fictícia
  return liveCourses.filter((c) => c.progress === 0).slice(0, 6);
}

export function isBlockVisible(user: CurrentUser, block: DashboardBlockId): boolean {
  return user.dashboard.blocks.includes(block);
}
