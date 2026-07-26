/**
 * Upload allow-lists. The client checks these for fast feedback; storage RLS
 * scopes every path to the owner so a bypass still can't write elsewhere.
 */
export type UploadKind = "image" | "video" | "media";

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];
const VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
];

const LIMITS: Record<UploadKind, { types: string[]; maxBytes: number; label: string }> = {
  image: { types: IMAGE_TYPES, maxBytes: 15 * 1024 * 1024, label: "imagem (JPG, PNG, WEBP, GIF) até 15 MB" },
  video: { types: VIDEO_TYPES, maxBytes: 2 * 1024 * 1024 * 1024, label: "vídeo (MP4, MOV, WEBM) até 2 GB" },
  media: {
    types: [...IMAGE_TYPES, ...VIDEO_TYPES],
    maxBytes: 2 * 1024 * 1024 * 1024,
    label: "imagem até 15 MB ou vídeo até 2 GB",
  },
};

const DANGEROUS_EXT =
  /\.(exe|sh|bat|cmd|com|scr|js|mjs|php|py|rb|jar|dll|so|html?|svg|xhtml)$/i;

/** Throws a user-facing Error when the file is not acceptable. */
export function assertUploadAllowed(file: File, kind: UploadKind) {
  const rule = LIMITS[kind];
  const type = (file.type || "").toLowerCase();

  if (DANGEROUS_EXT.test(file.name)) {
    throw new Error("Esse tipo de ficheiro não é permitido.");
  }
  if (!rule.types.includes(type)) {
    throw new Error(`Formato não suportado. Aceitamos ${rule.label}.`);
  }
  const isImage = IMAGE_TYPES.includes(type);
  const max = kind === "media" && isImage ? LIMITS.image.maxBytes : rule.maxBytes;
  if (file.size > max) {
    throw new Error(
      `Ficheiro demasiado grande (máx. ${Math.round(max / (1024 * 1024))} MB).`,
    );
  }
}
