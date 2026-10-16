export const RECORDING_STORAGE_FULL = "O armazenamento de vídeo está cheio. A live continua, mas não será gravada. Liberta espaço ou aumenta o plano no Cloudflare Stream.";
export function recordingStorageBlock(usage: { full: boolean }): string | null {
  return usage.full ? RECORDING_STORAGE_FULL : null;
}