import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  /^(localhost$|127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|.*\.local$|.*\.internal$)/i;

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
  .inputValidator((i: unknown) => z.object({ url: z.string().url().max(2000) }).parse(i))
  .handler(async ({ data }): Promise<LinkPreviewData | null> => {
    let u: URL;
    try {
      u = new URL(data.url);
    } catch {
      return null;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (BLOCKED_HOST.test(u.hostname)) return null;

    const isYouTube = /(^|\.)(youtube\.com|youtu\.be)$/i.test(u.hostname);
    const ytId = isYouTube ? youTubeId(u) : null;

    if (ytId) {
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
            `https://www.youtube.com/watch?v=${ytId}`,
          )}`,
          { signal: AbortSignal.timeout(8000) },
        );
        if (res.ok) {
          const j = (await res.json()) as {
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
        redirect: "follow",
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; MMClubBot/1.0; +https://mmclub.pt)",
          accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("html")) return null;
      const html = (await res.text()).slice(0, 400_000);

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
