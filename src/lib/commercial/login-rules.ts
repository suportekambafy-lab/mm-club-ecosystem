export function commercialDestination(value: unknown): string {
  if (typeof value !== "string") return "/comercial";
  return /^\/comercial(?:\/[a-zA-Z0-9_-]+)*\/?$/.test(value) ? value : "/comercial";
}