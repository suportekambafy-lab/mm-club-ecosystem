export function resolveLiveCoverUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/cover\.svg(\?|$)/, "/cover/svg$1");
}