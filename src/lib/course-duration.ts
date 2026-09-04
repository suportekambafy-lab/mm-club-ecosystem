import type { Course, Lesson } from "@/data/types";
import { parseVideoUrl } from "@/lib/video-source";

/**
 * Best-effort thumbnail for a lesson. Falls back through:
 *   1. Explicit lesson.cover
 *   2. YouTube video thumbnail derived from videoUrl
 *   3. Bunny.net Stream thumbnail derived from b-cdn.net pull zone
 *   4. Course logo (image asset) or course cover if that itself is an image URL
 * Returns an image URL suitable for `url(...)` backgrounds or <img src>.
 */
export function bunnyThumbFromUrl(raw: string): string | null {
  if (!raw) return null;
  const pullZone = (import.meta.env.VITE_BUNNY_PULL_ZONE as string | undefined)?.trim();
  try {
    const u = new URL(raw);
    // 1. Direct CDN URL: https://vz-xxx.b-cdn.net/{guid}/{playlist.m3u8|play_*.mp4|...}
    if (u.hostname.endsWith("b-cdn.net")) {
      const guid = u.pathname.split("/").filter(Boolean)[0];
      if (guid) return `${u.origin}/${guid}/thumbnail.jpg`;
    }
    // 2. Bunny iframe/embed URL: https://iframe.mediadelivery.net/(embed|play|thumbnail)/{libraryId}/{guid}[/...]
    if (u.hostname === "iframe.mediadelivery.net" || u.hostname.endsWith(".mediadelivery.net")) {
      const parts = u.pathname.split("/").filter(Boolean);
      const guidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const guid = parts.find((p) => guidRe.test(p));
      if (guid && pullZone) {
        const host = pullZone.includes(".") ? pullZone : `${pullZone}.b-cdn.net`;
        return `https://${host}/${guid}/thumbnail.jpg`;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Thumbnail do Panda Video (b-vz-<zona>.tv.pandavideo.com.br/<id>/thumbnail.jpg). */
export function pandaThumbFromUrl(raw: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!u.hostname.endsWith("pandavideo.com.br")) return null;
    const id =
      u.searchParams.get("v") ??
      u.pathname.split("/").filter(Boolean).find((p) => /^[0-9a-f-]{8,}$/i.test(p)) ??
      null;
    if (!id) return null;
    const host = u.hostname.startsWith("player-")
      ? u.hostname.replace(/^player-/, "b-")
      : u.hostname.startsWith("b-")
        ? u.hostname
        : null;
    if (!host) return null;
    return `https://${host}/${id}/thumbnail.jpg`;
  } catch {
    return null;
  }
}

/**
 * Best-effort thumbnail for a lesson. Falls back through:
 *   1. Explicit lesson.cover
 *   2. YouTube thumbnail derived from videoUrl
 *   3. Bunny.net thumbnail (b-cdn.net or iframe.mediadelivery.net embed/play/playlist)
 *   4. Module cover (the module the lesson belongs to)
 *   5. Course logo or extracted image URL from course.cover
 */
function imageFromToken(value?: string | null): string | null {
  const v = value?.trim();
  if (!v) return null;
  const inUrl = v.match(/url\(([^)]+)\)/);
  if (inUrl) return inUrl[1].replace(/["']/g, "");
  if (/^(https?:|\/|data:|blob:)/.test(v)) return v;
  return null;
}

function moduleCoverForLesson(
  lesson: Lesson | null | undefined,
  course: Course,
): string | null {
  if (!lesson) return null;
  const mod = course.modules?.find((m) => m.lessons.some((l) => l.id === lesson.id));
  return imageFromToken(mod?.cover);
}

export function lessonThumb(
  lesson: Lesson | null | undefined,
  course: Course,
): string | null {
  // An explicit lesson cover set in the admin always wins.
  const explicit = imageFromToken(lesson?.cover);
  if (explicit) return explicit;

  const raw = (lesson?.videoUrl ?? "").trim();
  if (raw) {
    const v = parseVideoUrl(raw);
    if (v.kind === "youtube" && v.embedUrl) {
      const m = v.embedUrl.match(/embed\/([\w-]+)/);
      if (m) return `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`;
    }
    const bunny = bunnyThumbFromUrl(raw);
    if (bunny) return bunny;
    // Panda: return null so the async hook can capture a mid-video frame
    // (Panda's static thumbnail.jpg is the first frame, usually black).
    if (pandaThumbFromUrl(raw)) return null;
  }

  if (lesson?.cover) return lesson.cover;
  const modCover = moduleCoverForLesson(lesson, course);
  if (modCover) return modCover;
  if (course.logo) return course.logo;
  return imageFromToken(course.cover);
}




// Parse strings like "12m", "1h", "1h 20m", "90 min", "4:12" (mm:ss),
// "1:20:00" (h:mm:ss) -> seconds.
// IMPORTANT: two-part "M:SS" values come from real video durations
// (Bunny/YouTube) and are minutes:seconds — never hours:minutes.
export function parseDurationToSeconds(input?: string): number {
  if (!input) return 0;
  const s = input.trim().toLowerCase();
  if (!s) return 0;

  if (/^\d+:\d{1,2}(:\d{1,2})?$/.test(s)) {
    const parts = s.split(":").map((n) => parseInt(n, 10));
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  let seconds = 0;
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*m/);
  const sec = s.match(/(\d+)\s*s(?!\w)/);
  if (h) seconds += parseInt(h[1], 10) * 3600;
  if (m) seconds += parseInt(m[1], 10) * 60;
  if (sec) seconds += parseInt(sec[1], 10);
  if (!h && !m && !sec) {
    const n = parseInt(s, 10);
    if (!Number.isNaN(n)) seconds += n * 60; // bare number = minutes
  }
  return seconds;
}

export function parseDurationToMinutes(input?: string): number {
  const sec = parseDurationToSeconds(input);
  return sec > 0 ? Math.max(1, Math.round(sec / 60)) : 0;
}

export function formatMinutes(total: number): string {
  if (total <= 0) return "0m";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** Real course duration: sum of every lesson's actual video length. */
export function computeCourseDurationSeconds(course: Course): number {
  return (
    course.modules?.reduce(
      (sum, mod) =>
        sum + mod.lessons.reduce((s, l: Lesson) => s + parseDurationToSeconds(l.duration), 0),
      0,
    ) ?? 0
  );
}

export function computeCourseDuration(course: Course): string {
  const seconds = computeCourseDurationSeconds(course);
  if (seconds <= 0) return course.duration;
  return formatMinutes(Math.max(1, Math.round(seconds / 60)));
}

export function computeLessonsCount(course: Course): number {
  return course.modules?.reduce((n, m) => n + m.lessons.length, 0) ?? course.lessonsCount;
}

export function findLesson(course: Course, lessonId: string | null | undefined) {
  if (!lessonId || !course.modules) return null;
  for (const m of course.modules) {
    const l = m.lessons.find((x) => x.id === lessonId);
    if (l) return l;
  }
  return null;
}
