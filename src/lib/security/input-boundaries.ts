/** Quote a value inside the filter grammar; punctuation stays data. */
export function quotedContains(term: string): string {
  return `"%${term.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/%/g, "\\%").replace(/_/g, "\\_")}%"`;
}

/** Spreadsheet applications interpret formulas even inside quoted cells. */
export function csvCell(value: unknown): string {
  const raw = String(value ?? "");
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(raw) || /^[\t\r\n]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

const allowedOrigins = new Set([
  "https://mmclub.pt", "https://www.mmclub.pt", "https://mmclub.online", "https://www.mmclub.online",
  "https://mm-club-ecosystem.lovable.app",
  "https://id-preview--70574eb9-2b6c-447b-adde-9f59b54cc086.lovable.app",
  "http://localhost:8080",
]);

export function trustedPaymentOrigin(raw: string): string {
  const url = new URL(raw);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash || !allowedOrigins.has(url.origin)) {
    throw new Error("Destino de pagamento inválido.");
  }
  return url.origin;
}

export function internalReturnPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || /[\\\u0000-\u0020]/.test(path)) {
    throw new Error("Destino de pagamento inválido.");
  }
  const url = new URL(path, "https://mmclub.pt");
  if (url.origin !== "https://mmclub.pt") throw new Error("Destino de pagamento inválido.");
  return `${url.pathname}${url.search}${url.hash}`;
}