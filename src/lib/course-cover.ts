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
 * known editorial cover -> gradient token.
 * Never falls back to a lesson video frame: the course cover must not be
 * replaced by a still of the first lesson.
 */
export function courseCoverImage(course: Course): string | null {
  const cover = course.cover?.trim();
  if (isImageUrl(cover)) return cover!;
  const inUrl = cover?.match(/url\(([^)]+)\)/);
  if (inUrl) return inUrl[1].replace(/["']/g, "");
  return FALLBACK_COVERS[course.id] ?? null;
}


/** CSS `background` value for a course card cover. */
export function courseCoverBackground(course: Course): string {
  const img = courseCoverImage(course);
  return img ? `url(${img}) center/cover no-repeat, #000` : course.cover;
}
