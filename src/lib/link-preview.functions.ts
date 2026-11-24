import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  kind: "youtube" | "link";
  embedUrl?: string | null;
}

const BLOCKED_HOST =
  /^(localhost$|.*\.localhost$|127\.|10\.|0\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|.*\.local$|.*\.internal$|metadata\.)/i;

/** Rejeita IPs literais (IPv6 sempre; IPv4 privados via BLOCKED_HOST) e nomes sem ponto. */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h.startsWith("[") || h.includes(":")) return true;
  if (!h.includes(".")) return true;
  if (/^\d+$/.test(h) || /^0x/i.test(h)) return true;
  return BLOCKED_HOST.test(h);
}

async function readCapped(res: Response, max: number): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let o = 0;
  for (const c of chunks) {
    buf.set(c, o);
    o += c.byteLength;
  }
  return new TextDecoder().decode(buf);
}

function decodeEntities(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function meta(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`,
      "i",
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`,
      "i",
    );
    const m = html.match(re) ?? html.match(re2);
    if (m?.[1]) return decodeEntities(m[1]).trim();
  }
  return null;
}

function youTubeId(u: URL): string | null {
  if (u.hostname.includes("youtu.be")) return u.pathname.split("/").filter(Boolean)[0] ?? null;
  const v = u.searchParams.get("v");
  if (v) return v;
  const parts = u.pathname.split("/").filter(Boolean);
  const i = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "live");
  return i >= 0 ? (parts[i + 1] ?? null) : null;
}

/** Lê metadados Open Graph de um URL público para pré-visualização em publicações. */
export const fetchLinkPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ url: z.string().url().max(2000) }).parse(i))
  .handler(async ({ data }): Promise<LinkPreviewData | null> => {
    let u: URL;
    try {
      u = new URL(data.url);
    } catch {
      return null;
    }
    if (u.protocol !== "https:" || u.username || u.password) return null;
    if (u.port && u.port !== "443") return null;
    if (isBlockedHost(u.hostname)) return null;

    const isYouTube = /(^|\.)(youtube\.com|youtu\.be)$/i.test(u.hostname);
    const ytId = isYouTube ? youTubeId(u) : null;

    if (ytId) {
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
            `https://www.youtube.com/watch?v=${ytId}`,
          )}`,
          { signal: AbortSignal.timeout(8000), redirect: "manual" },
        );
        const body = res.ok ? await readCapped(res, 64_000) : null;
        if (body) {
          const j = JSON.parse(body) as {
            title?: string;
            author_name?: string;
            thumbnail_url?: string;
          };
          return {
            url: u.toString(),
            title: j.title ?? null,
            description: j.author_name ?? null,
            image: `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`,
            siteName: "YouTube",
            kind: "youtube",
            embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1&playsinline=1`,
          };
        }
      } catch {
        // cai para o fallback abaixo
      }
      return {
        url: u.toString(),
        title: null,
        description: null,
        image: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
        siteName: "YouTube",
        kind: "youtube",
        embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1&playsinline=1`,
      };
    }

    try {
      const res = await fetch(u.toString(), {
        redirect: "manual",
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; MMClubBot/1.0; +https://mmclub.pt)",
          accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("html")) return null;
      const html = await readCapped(res, 400_000);
      if (!html) return null;

      const title =
        meta(html, ["og:title", "twitter:title"]) ??
        (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
          ? decodeEntities(html.match(/<title[^>]*>([^<]+)<\/title>/i)![1]).trim()
          : null);
      const description = meta(html, ["og:description", "twitter:description", "description"]);
      let image = meta(html, ["og:image:secure_url", "og:image", "twitter:image"]);
      if (image && image.startsWith("/")) image = new URL(image, u.origin).toString();
      const siteName = meta(html, ["og:site_name"]) ?? u.hostname.replace(/^www\./, "");

      if (!title && !description && !image) return null;
      return {
        url: u.toString(),
        title,
        description,
        image: image && /^https?:\/\//i.test(image) ? image : null,
        siteName,
        kind: "link",
      };
    } catch {
      return null;
    }
  });
