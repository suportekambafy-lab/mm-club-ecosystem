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

/**
 * Best-effort thumbnail for a lesson. Falls back through:
 *   1. Explicit lesson.cover
 *   2. YouTube thumbnail derived from videoUrl
 *   3. Bunny.net thumbnail (b-cdn.net or iframe.mediadelivery.net embed/play/playlist)
 *   4. Course logo or extracted image URL from course.cover
 */
export function lessonThumb(
  lesson: Lesson | null | undefined,
  course: Course,
): string | null {
  if (lesson?.cover) return lesson.cover;
  const raw = (lesson?.videoUrl ?? "").trim();
  if (raw) {
    const v = parseVideoUrl(raw);
    if (v.kind === "youtube" && v.embedUrl) {
      const m = v.embedUrl.match(/embed\/([\w-]+)/);
      if (m) return `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`;
    }
    const bunny = bunnyThumbFromUrl(raw);
    if (bunny) return bunny;
  }
  if (course.logo) return course.logo;
  const match = course.cover?.match(/url\(([^)]+)\)/);
  if (match) return match[1].replace(/["']/g, "");
  return null;
}



// Parse strings like "12m", "1h", "1h 20m", "90 min", "1:20" -> minutes
export function parseDurationToMinutes(input?: string): number {
  if (!input) return 0;
  const s = input.trim().toLowerCase();
  if (!s) return 0;

  // "1:20" or "01:20:00" style
  if (/^\d+:\d+(:\d+)?$/.test(s)) {
    const parts = s.split(":").map((n) => parseInt(n, 10));
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 60 + parts[1] + Math.round(parts[2] / 60);
  }

  let minutes = 0;
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*m/);
  if (h) minutes += parseInt(h[1], 10) * 60;
  if (m) minutes += parseInt(m[1], 10);
  if (!h && !m) {
    // bare number = minutes
    const n = parseInt(s, 10);
    if (!Number.isNaN(n)) minutes += n;
  }
  return minutes;
}

export function formatMinutes(total: number): string {
  if (total <= 0) return "0m";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function computeCourseDuration(course: Course): string {
  const total =
    course.modules?.reduce(
      (sum, mod) =>
        sum + mod.lessons.reduce((s, l: Lesson) => s + parseDurationToMinutes(l.duration), 0),
      0,
    ) ?? 0;
  return total > 0 ? formatMinutes(total) : course.duration;
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
