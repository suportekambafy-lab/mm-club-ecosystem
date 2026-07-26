/**
 * Client-safe module registry for Salas Interativas.
 *
 * Each module is a self-contained feature (reactions, questions, polls, …)
 * that can be turned on/off per live without touching the core.
 * Modules only *declare* themselves here (id + metadata); the actual UI
 * components live in `src/components/mm/room/modules/<id>/` and are loaded
 * lazily by the room shell. Server RPCs live in `src/lib/room-modules/<id>.functions.ts`.
 */

import type { LazyExoticComponent, ComponentType } from "react";

export type LiveMode = "broadcast" | "interactive";

export interface RoomModuleContext {
  liveId: string;
  role: "host" | "cohost" | "speaker" | "participant" | "viewer";
  isPublisher: boolean;
  isHostOrCohost: boolean;
}

export type RoomModulePanel = LazyExoticComponent<ComponentType<RoomModuleContext>>;
export type RoomModuleOverlay = LazyExoticComponent<ComponentType<RoomModuleContext>>;

export interface RoomModuleDefinition {
  id: string;
  label: string;
  description: string;
  supportedIn: LiveMode[];
  defaultEnabledIn: LiveMode[];
  // Availability status — lets us list "coming soon" modules in the wizard.
  status: "stable" | "beta" | "planned";
  Panel?: RoomModulePanel;
  Overlay?: RoomModuleOverlay;
}

// -------------------------------------------------------------------------
// Registry (Phase 1 declares them; components are wired in Phase 4).
// -------------------------------------------------------------------------
export const ROOM_MODULES: RoomModuleDefinition[] = [
  {
    id: "chat",
    label: "Chat",
    description: "Chat público em tempo real com o modo de administração já existente.",
    supportedIn: ["broadcast", "interactive"],
    defaultEnabledIn: ["broadcast", "interactive"],
    status: "stable",
  },
  {
    id: "reactions",
    label: "Reações rápidas",
    description: "Emojis flutuantes sobre o palco (👏 ❤️ 🔥 😂 👍) sem abrir o chat.",
    supportedIn: ["broadcast", "interactive"],
    defaultEnabledIn: ["interactive"],
    status: "planned",
  },
  {
    id: "questions",
    label: "Perguntas & Respostas",
    description: "Separador dedicado com upvotes. O anfitrião marca como respondida ou destaca.",
    supportedIn: ["broadcast", "interactive"],
    defaultEnabledIn: ["interactive"],
    status: "planned",
  },
  {
    id: "polls",
    label: "Enquetes",
    description: "Votações rápidas com resultados em tempo real, projetáveis no palco.",
    supportedIn: ["interactive"],
    defaultEnabledIn: [],
    status: "planned",
  },
  {
    id: "breakouts",
    label: "Salas paralelas",
    description: "Dividir participantes em pequenos grupos e regressar automaticamente. (Em breve)",
    supportedIn: ["interactive"],
    defaultEnabledIn: [],
    status: "planned",
  },
  {
    id: "speed-networking",
    label: "Networking automático",
    description: "Emparelhamento aleatório de 5 minutos com rotação automática. (Em breve)",
    supportedIn: ["interactive"],
    defaultEnabledIn: [],
    status: "planned",
  },
];

export const ROOM_MODULES_BY_ID = Object.fromEntries(
  ROOM_MODULES.map((m) => [m.id, m] as const),
) as Record<string, RoomModuleDefinition>;

export function defaultEnabledModulesFor(mode: LiveMode): string[] {
  return ROOM_MODULES.filter((m) => m.defaultEnabledIn.includes(mode)).map((m) => m.id);
}

export function moduleIsActive(enabledModules: unknown, id: string): boolean {
  if (!Array.isArray(enabledModules)) return false;
  return enabledModules.includes(id);
}
