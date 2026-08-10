/**
 * MM Product Lab — extração de página (server-only).
 * Faz o download do HTML e recolhe sinais estruturados (og:, JSON-LD, título, preço)
 * mais um resumo de texto limpo para a IA analisar. Nunca inventa dados.
 */

export interface PageSignals {
  ok: boolean;
  url: string;
  host: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  price: string | null;
  currency: string | null;
  jsonLd: string | null;
  text: string;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

function decode(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)));
}

function meta(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name|itemprop)\\s*=\\s*["']${key}["'][^>]*>`,
      "i",
    );
    const tag = re.exec(html)?.[0];
    if (!tag) continue;
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (content && content.trim()) return decode(content.trim()).slice(0, 500);
  }
  return null;
}

function absolute(url: string | null, base: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}

/** Bloqueia hosts internos/privados (SSRF). */
function isPublicHttpUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase();
  if (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h.includes(":")
  ) {
    return null;
  }
  return u;
}

export function normalizeProductUrl(raw: string): string | null {
  const trimmed = raw.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return isPublicHttpUrl(withScheme)?.toString() ?? null;
}

export async function fetchPageSignals(url: string): Promise<PageSignals> {
  const u = isPublicHttpUrl(url);
  const empty: PageSignals = {
    ok: false,
    url,
    host: u?.hostname ?? "",
    title: null,
    description: null,
    image: null,
    siteName: null,
    price: null,
    currency: null,
    jsonLd: null,
    text: "",
  };
  if (!u) return empty;

  let html = "";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(u.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return empty;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html") && !type.includes("text")) return empty;
    html = (await res.text()).slice(0, 600_000);
  } catch {
    return empty;
  }

  const jsonLdBlocks: string[] = [];
  const ldRe = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = ldRe.exec(html)) && jsonLdBlocks.length < 4) {
    const body = (m[1] ?? "").trim();
    if (body.length > 20 && /product|offer|price|name/i.test(body)) jsonLdBlocks.push(body.slice(0, 6000));
  }

  const text = decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 9000);

  return {
    ok: text.length > 60 || jsonLdBlocks.length > 0,
    url: u.toString(),
    host: u.hostname,
    title:
      meta(html, ["og:title", "twitter:title"]) ??
      (decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").trim() || null),
    description: meta(html, ["og:description", "twitter:description", "description"]),
    image: absolute(meta(html, ["og:image:secure_url", "og:image", "twitter:image", "image"]), u.toString()),
    siteName: meta(html, ["og:site_name", "application-name"]),
    price: meta(html, ["product:price:amount", "og:price:amount", "price"]),
    currency: meta(html, ["product:price:currency", "og:price:currency", "priceCurrency"]),
    jsonLd: jsonLdBlocks.length ? jsonLdBlocks.join("\n---\n") : null,
    text,
  };
}
