// Admin overrides — persist course/expert/lesson edits in localStorage and
// apply them to the in-memory data so every consumer picks them up.

import { courses, coursesById } from "./courses";
import { experts, expertsById } from "./experts";
import type { Course, Expert, Lesson } from "./types";

const STORAGE_KEY = "mm-club.admin.overrides.v2";

export type CourseOverride = Partial<
  Pick<Course, "title" | "tagline" | "description" | "cover" | "logo" | "duration">
>;
export type ExpertOverride = Partial<Pick<Expert, "name" | "role" | "photo" | "logo" | "shortBio">>;
export type LessonOverride = Partial<Pick<Lesson, "title" | "duration" | "videoUrl">>;

export interface Overrides {
  courses: Record<string, CourseOverride>;
  experts: Record<string, ExpertOverride>;
  lessons: Record<string, LessonOverride>; // keyed by lesson id (unique across courses)
}

function emptyOverrides(): Overrides {
  return { courses: {}, experts: {}, lessons: {} };
}

export function loadOverrides(): Overrides {
  if (typeof window === "undefined") return emptyOverrides();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyOverrides();
    const parsed = JSON.parse(raw);
    return {
      courses: parsed.courses ?? {},
      experts: parsed.experts ?? {},
      lessons: parsed.lessons ?? {},
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

export function applyOverrides(o: Overrides) {
  snapshot();
  // Reset to originals
  for (const c of courses) {
    const orig = originalCourses.get(c.id);
    if (orig) Object.assign(c, orig);
  }
  for (const e of experts) {
    const orig = originalExperts.get(e.id);
    if (orig) Object.assign(e, orig);
  }
  for (const c of courses) {
    for (const m of c.modules ?? []) {
      for (const l of m.lessons) {
        const orig = originalLessons.get(l.id);
        if (orig) Object.assign(l, orig);
      }
    }
  }
  // Apply overrides
  for (const [id, patch] of Object.entries(o.courses)) {
    const c = coursesById[id];
    if (c) Object.assign(c, patch);
  }
  for (const [id, patch] of Object.entries(o.experts)) {
    const e = expertsById[id];
    if (e) Object.assign(e, patch);
  }
  for (const c of courses) {
    for (const m of c.modules ?? []) {
      for (const l of m.lessons) {
        const patch = o.lessons[l.id];
        if (patch) Object.assign(l, patch);
      }
    }
  }
}

// Apply on load (browser only)
if (typeof window !== "undefined") {
  applyOverrides(loadOverrides());
}
