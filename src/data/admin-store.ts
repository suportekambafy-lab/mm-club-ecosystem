// Admin overrides — persist course edits in localStorage and apply them
// to the in-memory `courses` array so every consumer picks them up.

import { courses, coursesById } from "./courses";
import { experts, expertsById } from "./experts";
import type { Course, Expert } from "./types";

const STORAGE_KEY = "mm-club.admin.overrides.v1";

export type CourseOverride = Partial<
  Pick<Course, "title" | "tagline" | "description" | "cover" | "logo" | "duration">
>;
export type ExpertOverride = Partial<Pick<Expert, "name" | "role" | "photo" | "logo" | "shortBio">>;

export interface Overrides {
  courses: Record<string, CourseOverride>;
  experts: Record<string, ExpertOverride>;
}

function emptyOverrides(): Overrides {
  return { courses: {}, experts: {} };
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
}

export function applyOverrides(o: Overrides) {
  snapshot();
  // Reset to originals first
  for (const c of courses) {
    const orig = originalCourses.get(c.id);
    if (orig) Object.assign(c, orig);
  }
  for (const e of experts) {
    const orig = originalExperts.get(e.id);
    if (orig) Object.assign(e, orig);
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
}

// Apply on load (browser only)
if (typeof window !== "undefined") {
  applyOverrides(loadOverrides());
}
