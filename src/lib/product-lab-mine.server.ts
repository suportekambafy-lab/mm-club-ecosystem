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
/** A página traz mesmo dados de produto ou é só a casca anti-bot? */
function hasProductSignals(html: string): boolean {
  if (/captcha|unusual traffic|Access Denied|Are you a robot/i.test(html.slice(0, 4000))) return false;
  const hasPrice =
    /application\/ld\+json/i.test(html) ||
    /(?:product:price:amount|og:price:amount|itemprop=["']price["'])/i.test(html) ||
    /"(?:formatedActivityPrice|formatedPrice|salePrice|priceCurrency|priceAmount)"/i.test(html);
  const hasTitle = /<meta[^>]+og:title[^>]+content\s*=\s*["'][^"']{3,}/i.test(html) || /<title[^>]*>[^<]{3,}/i.test(html);
  return hasPrice && hasTitle;
}

/** Fallback com render real: Firecrawl quando ligado, senão leitor público. */
async function fetchRenderedHtml(url: string): Promise<string | null> {
  const fcKey = process.env["FIRECRAWL_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const body = JSON.stringify({ url, formats: ["rawHtml", "markdown"], onlyMainContent: false, waitFor: 2500 });

  if (fcKey) {
    const gateway = !fcKey.startsWith("fc-");
    const endpoint = gateway
      ? "https://connector-gateway.lovable.dev/firecrawl/v2/scrape"
      : "https://api.firecrawl.dev/v2/scrape";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (gateway) {
      if (!lovableKey) return null;
      headers["Authorization"] = `Bearer ${lovableKey}`;
      headers["X-Connection-Api-Key"] = fcKey;
    } else {
      headers["Authorization"] = `Bearer ${fcKey}`;
    }
    try {
      const res = await fetch(endpoint, { method: "POST", headers, body });
      if (res.ok) {
        const json = (await res.json()) as Record<string, any>;
        const d = json["data"] ?? json;
        const raw: string | null = d?.rawHtml ?? d?.html ?? null;
        const md: string | null = d?.markdown ?? null;
        if (raw) return raw.slice(0, 600_000);
        if (md) return `<html><body>${md}</body></html>`.slice(0, 600_000);
      }
    } catch {
      /* segue para o leitor público */
    }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: controller.signal,
      headers: { Accept: "text/plain", "User-Agent": UA },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = (await res.text()).slice(0, 200_000);
    return text.trim() ? `<html><body>${text}</body></html>` : null;
  } catch {
    return null;
  }
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
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && (type.includes("html") || type.includes("text"))) {
      html = (await res.text()).slice(0, 600_000);
    }
  } catch {
    html = "";
  }

  // Lojas com JS/anti-bot (AliExpress, Temu…) devolvem uma casca sem preço:
  // nesse caso tenta um leitor de páginas com render real.
  if (!html || !hasProductSignals(html)) {
    const rendered = await fetchRenderedHtml(u.toString());
    if (rendered && (hasProductSignals(rendered) || !html)) html = rendered;
  }
  if (!html) return empty;


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

  const fromLd = priceFromJsonLd(jsonLdBlocks);
  const metaPrice = meta(html, ["product:price:amount", "og:price:amount", "price"]);
  const metaCurrency = meta(html, ["product:price:currency", "og:price:currency", "priceCurrency"]);
  const itemProp = /itemprop\s*=\s*["']price["'][^>]*content\s*=\s*["']([^"']+)["']/i.exec(html)?.[1] ?? null;
  const embedded = priceFromEmbeddedJson(html);
  const inline = priceFromText(text);

  const price = normalizeAmount(
    metaPrice ?? fromLd.price ?? itemProp ?? embedded.price ?? inline.price,
  );
  const currency =
    (metaCurrency ?? fromLd.currency ?? embedded.currency ?? inline.currency ?? null)?.toUpperCase() ??
    null;

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
    price,
    currency,
    jsonLd: jsonLdBlocks.length ? jsonLdBlocks.join("\n---\n") : null,
    text,
  };
}

/** Percorre blocos JSON-LD à procura de offers.price / lowPrice. */
function priceFromJsonLd(blocks: string[]): { price: string | null; currency: string | null } {
  let price: string | null = null;
  let currency: string | null = null;
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const key = k.toLowerCase();
      if (!price && (key === "price" || key === "lowprice") && (typeof v === "string" || typeof v === "number")) {
        price = String(v);
      } else if (!currency && key === "pricecurrency" && typeof v === "string") {
        currency = v;
      } else if (v && typeof v === "object") {
        visit(v);
      }
    }
  };
  for (const block of blocks) {
    try {
      visit(JSON.parse(block));
    } catch {
      // JSON-LD inválido: procura pares soltos no texto bruto.
      if (!price) price = /"(?:low)?price"\s*:\s*"?([\d.,]+)"?/i.exec(block)?.[1] ?? null;
      if (!currency) currency = /"pricecurrency"\s*:\s*"([A-Za-z]{3})"/i.exec(block)?.[1] ?? null;
    }
    if (price && currency) break;
  }
  return { price, currency };
}

const CURRENCY_SYMBOLS: Record<string, string> = { "€": "EUR", $: "USD", "£": "GBP", "R$": "BRL" };

/**
 * Lojas SPA (AliExpress, Shopify, Temu…) escondem o preço em JSON embutido no HTML.
 * Procura pares conhecidos antes de recorrer ao texto visível.
 */
function priceFromEmbeddedJson(html: string): { price: string | null; currency: string | null } {
  const currency =
    /"(?:currencyCode|priceCurrency|currency)"\s*:\s*"([A-Za-z]{3})"/i.exec(html)?.[1] ??
    /"currency"\s*:\s*\{[^}]*"code"\s*:\s*"([A-Za-z]{3})"/i.exec(html)?.[1] ??
    null;

  const patterns: RegExp[] = [
    /"(?:formatedActivityPrice|formatedPrice)"\s*:\s*"([^"]+)"/i,
    /"(?:minActivityAmount|minAmount|skuActivityAmount|skuAmount)"\s*:\s*\{[^}]*"value"\s*:\s*([\d.]+)/i,
    /"(?:salePrice|sale_price|priceAmount|current_price|finalPrice)"\s*:\s*"?([\d.,]+)"?/i,
    /"price(?:_amount|Amount|Value|)"\s*:\s*"?([\d.,]+)"?/i,
    /"price"\s*:\s*\{[^}]*"amount"\s*:\s*"?([\d.,]+)"?/i,
  ];
  for (const re of patterns) {
    const raw = re.exec(html)?.[1];
    if (!raw) continue;
    const amount = normalizeAmount(raw);
    if (amount) {
      // Shopify e afins usam cêntimos em campos *_price inteiros.
      const cents = /"(?:price|sale_price)"\s*:\s*(\d{4,})[,}]/.exec(html)?.[1];
      if (cents && cents === raw && !raw.includes(".") && !raw.includes(",")) {
        return { price: String(Number(cents) / 100), currency };
      }
      return { price: amount, currency };
    }
  }
  return { price: null, currency };
}

/** Último recurso: primeiro valor monetário legível no texto da página. */
function priceFromText(text: string): { price: string | null; currency: string | null } {
  const re = /(R\$|€|\$|£)\s?(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{1,2})?)|(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{1,2})?)\s?(R\$|€|\$|£|EUR|USD|GBP|BRL)/i;
  const m = re.exec(text);
  if (!m) return { price: null, currency: null };
  const symbol = (m[1] ?? m[4] ?? "").trim();
  const raw = m[2] ?? m[3] ?? null;
  const code = /^[A-Za-z]{3}$/.test(symbol) ? symbol.toUpperCase() : (CURRENCY_SYMBOLS[symbol] ?? null);
  return { price: raw, currency: code };
}

/** "1.234,56" / "1,234.56" / "24,90 €" -> "1234.56". */
export function normalizeAmount(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return null;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;
  if (lastComma > -1 && lastDot > -1) {
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastComma > -1) {
    normalized = cleaned.length - lastComma <= 3 ? cleaned.replace(",", ".") : cleaned.replace(/,/g, "");
  } else if (lastDot > -1 && cleaned.length - lastDot > 3) {
    normalized = cleaned.replace(/\./g, "");
  }
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? String(n) : null;
}

/** Canal de origem provável a partir do domínio (valores de PL_SOURCES). */
export function guessSource(host: string): string | null {
  const h = host.toLowerCase();
  if (/tiktok|douyin/.test(h)) return "TikTok";
  if (/facebook|fb\.|instagram|meta\.com|fbcdn/.test(h)) return "Meta Ads";
  if (/aliexpress|alibaba|cjdropshipping|temu|1688|dsers|zendrop|spocket|banggood/.test(h))
    return "Ferramenta de Dropshipping";
  if (h) return "Pesquisa própria";
  return null;
}

/** Fornecedor provável: marketplace conhecido ou domínio raiz. */
export function guessSupplier(host: string): string | null {
  const h = host.toLowerCase().replace(/^www\./, "");
  if (!h) return null;
  const known: [RegExp, string][] = [
    [/aliexpress/, "AliExpress"],
    [/alibaba|1688/, "Alibaba"],
    [/cjdropshipping/, "CJ Dropshipping"],
    [/temu/, "Temu"],
    [/amazon/, "Amazon"],
    [/ebay/, "eBay"],
    [/shein/, "Shein"],
    [/banggood/, "Banggood"],
  ];
  for (const [re, name] of known) if (re.test(h)) return name;
  return h;
}

/** Marketplaces/fornecedores conhecidos: o produto entra logo na coluna Fornecedores. */
export function isSupplierHost(host: string): boolean {
  const h = host.toLowerCase();
  return /aliexpress|alibaba|1688|cjdropshipping|temu|banggood|shein|dsers|zendrop|spocket|amazon|ebay|dhgate|made-in-china|autods/.test(
    h,
  );
}



const TLD_MARKET: Record<string, string> = {
  pt: "Portugal",
  br: "Brasil",
  es: "Espanha",
  fr: "França",
  it: "Itália",
  de: "Alemanha",
  uk: "Reino Unido",
  nl: "Países Baixos",
  us: "Estados Unidos",
};

const CURRENCY_MARKET: Record<string, string> = {
  EUR: "Europa (zona euro)",
  BRL: "Brasil",
  USD: "Estados Unidos",
  GBP: "Reino Unido",
};

/** Mercado provável a partir do TLD e, em alternativa, da moeda. */
export function guessMarket(host: string, currency: string | null): string | null {
  const tld = host.toLowerCase().split(".").pop() ?? "";
  if (TLD_MARKET[tld]) return TLD_MARKET[tld]!;
  if (currency && CURRENCY_MARKET[currency]) return CURRENCY_MARKET[currency]!;
  return null;
}

