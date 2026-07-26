import type { Course } from "@/data/types";
import { lessonThumb } from "@/lib/course-duration";
import marcaMilionariaCoverAsset from "@/assets/marca-milionaria-cover.png.asset.json";

const FALLBACK_COVERS: Record<string, string> = {
  "marca-milionaria": marcaMilionariaCoverAsset.url,
};

function isImageUrl(value?: string | null): boolean {
  return !!value && /^(https?:|\/|data:|blob:)/.test(value.trim());
}

/**
 * The course artwork used on catalog cards and course pages.
 * Priority: explicit cover image -> url() inside a cover token ->
 * known editorial cover -> first lesson video frame.
 * Returns null when only a gradient token exists.
 */
export function courseCoverImage(course: Course): string | null {
  const cover = course.cover?.trim();
  if (isImageUrl(cover)) return cover!;
  const inUrl = cover?.match(/url\(([^)]+)\)/);
  if (inUrl) return inUrl[1].replace(/["']/g, "");
  const known = FALLBACK_COVERS[course.id];
  if (known) return known;
  const firstLesson = course.modules?.[0]?.lessons?.[0];
  return lessonThumb(firstLesson, course);
}

/** CSS `background` value for a course card cover. */
export function courseCoverBackground(course: Course): string {
  const img = courseCoverImage(course);
  return img ? `url(${img}) center/cover no-repeat, #000` : course.cover;
}
