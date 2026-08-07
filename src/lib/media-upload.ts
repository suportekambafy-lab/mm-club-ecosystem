import { supabase } from "@/integrations/supabase/client";
import { assertUploadAllowed, type UploadKind } from "@/lib/security/uploads";

// 10 years in seconds — signed URLs are the only reliable way to serve
// media from private buckets in <img>/<video> tags without auth headers.
const SIGN_TTL = 60 * 60 * 24 * 365 * 10;

export type MediaBucket = "course-media" | "lesson-videos" | "studio-media" | "community-media" | "avatars";

export async function uploadMedia(
  bucket: MediaBucket,
  file: File,
  keyPrefix: string,
  kind?: UploadKind,
): Promise<{ url: string; path: string }> {
  assertUploadAllowed(file, kind ?? (bucket === "lesson-videos" ? "video" : "media"));

  const ext = file.name.split(".").pop() || "bin";
  const safe = keyPrefix.replace(/[^a-zA-Z0-9-_/]/g, "-");
  const path = `${safe}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (upErr) throw upErr;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGN_TTL);
  if (error || !data) throw error ?? new Error("Falha ao gerar URL");
  return { url: data.signedUrl, path };
}
