// Admin overrides — the database row is the source of truth for course/expert/
// module/lesson edits. localStorage is only a fast fallback until the remote row
// is fetched, never the final truth shown to members.

import { courses, coursesById } from "./courses";
import { experts, expertsById } from "./experts";
import type { Course, Expert, Lesson, Module } from "./types";

const STORAGE_KEY = "mm-club.admin.overrides.v3";
const REMOTE_ROW_ID = "courses";

export type CourseOverride = Partial<
  Pick<Course, "title" | "tagline" | "description" | "cover" | "logo" | "duration">
>;
export type ExpertOverride = Partial<Pick<Expert, "name" | "role" | "photo" | "logo" | "shortBio">>;
export type LessonOverride = Partial<Pick<Lesson, "title" | "duration" | "videoUrl" | "cover">>;

export interface Overrides {
  courses: Record<string, CourseOverride>;
  experts: Record<string, ExpertOverride>;
  /** Legacy per-lesson patches (still applied on top of modules). */
  lessons: Record<string, LessonOverride>;
  /** Full replacement of a course's modules array. */
  modulesByCourse: Record<string, Module[]>;
}

function emptyOverrides(): Overrides {
  return { courses: {}, experts: {}, lessons: {}, modulesByCourse: {} };
}

function normalizeOverrides(raw: unknown): Overrides {
  const parsed = (raw && typeof raw === "object" ? raw : {}) as Partial<Overrides>;
  return {
    courses: parsed.courses ?? {},
    experts: parsed.experts ?? {},
    lessons: parsed.lessons ?? {},
    modulesByCourse: parsed.modulesByCourse ?? {},
  };
}

function cloneOverrides(o: Overrides): Overrides {
  return JSON.parse(JSON.stringify(o)) as Overrides;
}

let currentOverrides: Overrides = emptyOverrides();
let remoteLoaded = typeof window === "undefined";
let remoteLoading = false;
let remoteError: string | null = null;
let remoteUpdatedAt: string | null = null;
let remotePromise: Promise<Overrides | null> | null = null;

export function loadOverrides(): Overrides {
  if (typeof window === "undefined") return emptyOverrides();
  return cloneOverrides(currentOverrides);
}

function loadLocalOverrides(): Overrides {
  if (typeof window === "undefined") return emptyOverrides();
  try {
    // Try v3 first, fall back to older keys for migration
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem("mm-club.admin.overrides.v2") ??
      window.localStorage.getItem("mm-club.admin.overrides.v1");
    if (!raw) return emptyOverrides();
    const parsed = JSON.parse(raw);
    return normalizeOverrides(parsed);
  } catch {
    return emptyOverrides();
  }
}

export function saveOverrides(o: Overrides) {
  if (typeof window === "undefined") return;
  const clean = normalizeOverrides(o);
  currentOverrides = cloneOverrides(clean);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
}

// Keep original snapshots so we can reset.
const originalCourses = new Map<string, CourseOverride>();
const originalExperts = new Map<string, ExpertOverride>();
const originalLessons = new Map<string, LessonOverride>();
const originalModules = new Map<string, Module[]>();
const originalLessonsCount = new Map<string, number>();

function snapshot() {
  if (originalCourses.size === 0) {
    for (const c of courses) {
      originalCourses.set(c.id, {
        title: c.title,
        tagline: c.tagline,
        description: c.description,
        cover: c.cover,
        logo: c.logo,
        duration: c.duration,
      });
      originalLessonsCount.set(c.id, c.lessonsCount);
    }
  }
  if (originalExperts.size === 0) {
    for (const e of experts) {
      originalExperts.set(e.id, {
        name: e.name,
        role: e.role,
        photo: e.photo,
        logo: e.logo,
        shortBio: e.shortBio,
      });
    }
  }
  if (originalModules.size === 0) {
    for (const c of courses) {
      originalModules.set(c.id, deepCloneModules(c.modules ?? []));
    }
  }
  if (originalLessons.size === 0) {
    for (const c of courses) {
      for (const m of c.modules ?? []) {
        for (const l of m.lessons) {
          originalLessons.set(l.id, {
            title: l.title,
            duration: l.duration,
            videoUrl: l.videoUrl,
            cover: l.cover,
          });

        }
      }
    }
  }
}

function deepCloneModules(mods: Module[]): Module[] {
  return mods.map((m) => ({
    id: m.id,
    title: m.title,
    lessons: m.lessons.map((l) => ({ ...l })),
  }));
}

function countLessons(mods: Module[]) {
  return mods.reduce((s, m) => s + m.lessons.length, 0);
}

export function applyOverrides(o: Overrides) {
  snapshot();
  const clean = normalizeOverrides(o);
  currentOverrides = cloneOverrides(clean);

  // Reset course/expert fields to originals
  for (const c of courses) {
    const orig = originalCourses.get(c.id);
    if (orig) Object.assign(c, orig);
    const origMods = originalModules.get(c.id);
    if (origMods) c.modules = deepCloneModules(origMods);
    const origCount = originalLessonsCount.get(c.id);
    if (origCount != null) c.lessonsCount = origCount;
  }
  for (const e of experts) {
    const orig = originalExperts.get(e.id);
    if (orig) Object.assign(e, orig);
  }

  // Apply full-modules replacement first (if any)
  for (const [courseId, mods] of Object.entries(clean.modulesByCourse)) {
    const c = coursesById[courseId];
    if (c) {
      c.modules = deepCloneModules(mods);
      c.lessonsCount = countLessons(c.modules);
    }
  }

  // Apply per-course field overrides
  for (const [id, patch] of Object.entries(clean.courses)) {
    const c = coursesById[id];
    if (c) Object.assign(c, patch);
  }
  for (const [id, patch] of Object.entries(clean.experts)) {
    const e = expertsById[id];
    if (e) Object.assign(e, patch);
  }

  // Apply legacy per-lesson patches (kept for backwards compat)
  for (const c of courses) {
    for (const m of c.modules ?? []) {
      for (const l of m.lessons) {
        const patch = clean.lessons[l.id];
        if (patch) Object.assign(l, patch);
      }
    }
  }

  version++;
  listeners.forEach((l) => l());
}

// --- Reactive subscription so React components re-render after overrides
// are applied on the client (SSR renders with base data; overrides land
// after hydration and must trigger a refresh). ---
let version = 0;
const listeners = new Set<() => void>();

export function subscribeOverrides(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getOverridesVersion() {
  return version;
}

export function getOverridesReady() {
  return remoteLoaded;
}

export function getOverridesStatus() {
  return {
    remoteLoaded,
    remoteLoading,
    remoteError,
    remoteUpdatedAt,
  };
}

function notifySubscribers() {
  version++;
  listeners.forEach((l) => l());
}

async function clearLegacyRuntimeCaches() {
  if (typeof window === "undefined") return;
  try {
    if ("caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(
        keys
          .filter((key) => /mm|club|workbox|vite|tanstack|academy|academia/i.test(key))
          .map((key) => window.caches.delete(key)),
      );
    }
  } catch {
    // Cache cleanup is best-effort only.
  }
}

export async function refreshAdminOverrides(options: { force?: boolean } = {}) {
  if (typeof window === "undefined") return null;
  if (remotePromise && !options.force) return remotePromise;

  remoteLoading = true;
  remoteError = null;
  notifySubscribers();

  remotePromise = (async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase
        .from("admin_overrides")
        .select("data,updated_at")
        .eq("id", REMOTE_ROW_ID)
        .maybeSingle();

      if (error) throw error;

      if (data?.data) {
        const remote = normalizeOverrides(data.data);
        remoteUpdatedAt = data.updated_at ?? new Date().toISOString();
        saveOverrides(remote);
        applyOverrides(remote);
        return remote;
      }

      remoteUpdatedAt = null;
      return null;
    } catch (error) {
      remoteError = (error as Error).message;
      return null;
    } finally {
      remoteLoaded = true;
      remoteLoading = false;
      remotePromise = null;
      notifySubscribers();
    }
  })();

  return remotePromise;
}

// Apply on load (browser only) — first localStorage (instant), then pull the
// shared server copy so admin edits show up in production for every visitor.
if (typeof window !== "undefined") {
  currentOverrides = loadLocalOverrides();
  applyOverrides(currentOverrides);
  void clearLegacyRuntimeCaches();
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) applyOverrides(loadLocalOverrides());
  });

  void refreshAdminOverrides({ force: true });

  window.addEventListener("focus", () => {
    void refreshAdminOverrides({ force: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void refreshAdminOverrides({ force: true });
    }
  });

  void (async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const channel = supabase
        .channel("admin-overrides-content-freshness")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "admin_overrides", filter: `id=eq.${REMOTE_ROW_ID}` },
          () => {
            void refreshAdminOverrides({ force: true });
          },
        )
        .subscribe();
      window.addEventListener("beforeunload", () => {
        void supabase.removeChannel(channel);
      });
    } catch {
      // Realtime unavailable — focus/visibility refresh still keeps content fresh.
    }
  })();
}

export async function pushOverridesToServer(o: Overrides) {
  if (typeof window === "undefined") return { ok: false as const, error: "SSR" };
  const clean = normalizeOverrides(o);
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase
      .from("admin_overrides")
      .upsert(
        {
          id: REMOTE_ROW_ID,
          data: clean as never,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    if (error) return { ok: false as const, error: error.message };
    remoteLoaded = true;
    remoteError = null;
    saveOverrides(clean);
    applyOverrides(clean);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

