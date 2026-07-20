// Admin overrides — persist course/expert/module/lesson edits in localStorage
// and apply them to the in-memory data so every consumer picks them up.

import { courses, coursesById } from "./courses";
import { experts, expertsById } from "./experts";
import type { Course, Expert, Lesson, Module } from "./types";

const STORAGE_KEY = "mm-club.admin.overrides.v3";

export type CourseOverride = Partial<
  Pick<Course, "title" | "tagline" | "description" | "cover" | "logo" | "duration">
>;
export type ExpertOverride = Partial<Pick<Expert, "name" | "role" | "photo" | "logo" | "shortBio">>;
export type LessonOverride = Partial<Pick<Lesson, "title" | "duration" | "videoUrl">>;

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

export function loadOverrides(): Overrides {
  if (typeof window === "undefined") return emptyOverrides();
  try {
    // Try v3 first, fall back to older keys for migration
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem("mm-club.admin.overrides.v2") ??
      window.localStorage.getItem("mm-club.admin.overrides.v1");
    if (!raw) return emptyOverrides();
    const parsed = JSON.parse(raw);
    return {
      courses: parsed.courses ?? {},
      experts: parsed.experts ?? {},
      lessons: parsed.lessons ?? {},
      modulesByCourse: parsed.modulesByCourse ?? {},
    };
  } catch {
    return emptyOverrides();
  }
}

export function saveOverrides(o: Overrides) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
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
  for (const [courseId, mods] of Object.entries(o.modulesByCourse)) {
    const c = coursesById[courseId];
    if (c) {
      c.modules = deepCloneModules(mods);
      c.lessonsCount = countLessons(c.modules);
    }
  }

  // Apply per-course field overrides
  for (const [id, patch] of Object.entries(o.courses)) {
    const c = coursesById[id];
    if (c) Object.assign(c, patch);
  }
  for (const [id, patch] of Object.entries(o.experts)) {
    const e = expertsById[id];
    if (e) Object.assign(e, patch);
  }

  // Apply legacy per-lesson patches (kept for backwards compat)
  for (const c of courses) {
    for (const m of c.modules ?? []) {
      for (const l of m.lessons) {
        const patch = o.lessons[l.id];
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

// Apply on load (browser only) — first localStorage (instant), then pull the
// shared server copy so admin edits show up in production for every visitor.
if (typeof window !== "undefined") {
  applyOverrides(loadOverrides());
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) applyOverrides(loadOverrides());
  });

  void (async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("admin_overrides")
        .select("data")
        .eq("id", "courses")
        .maybeSingle();
      const remote = (data?.data ?? null) as Overrides | null;
      if (remote && (remote.modulesByCourse || remote.courses || remote.experts)) {
        saveOverrides(remote);
        applyOverrides(remote);
      }
    } catch {
      // offline / unauth — fall back to local + base data
    }
  })();
}

export async function pushOverridesToServer(o: Overrides) {
  if (typeof window === "undefined") return { ok: false as const, error: "SSR" };
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase
      .from("admin_overrides")
      .upsert(
        {
          id: "courses",
          data: o as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

