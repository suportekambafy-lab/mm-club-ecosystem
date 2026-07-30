// Parses a video URL and returns how to render it.
//  - youtube / vimeo / bunny / panda  → iframe embed
//  - direct file (.mp4/.webm/.mov) → <video>
//  - anything else that looks like an iframe embed URL → iframe

export type VideoKind = "youtube" | "vimeo" | "bunny" | "panda" | "file" | "iframe" | "unknown";

export interface VideoSource {
  kind: VideoKind;
  embedUrl?: string; // for iframe kinds
  fileUrl?: string; // for direct <video>
  originalUrl: string;
}

export function parseVideoUrl(input: string | undefined): VideoSource {
  const url = (input ?? "").trim();
  if (!url) return { kind: "unknown", originalUrl: "" };

  let u: URL | null = null;
  try {
    u = new URL(url);
  } catch {
    // treat bare id (e.g. YouTube id) as youtube
    if (/^[\w-]{6,}$/.test(url)) {
      return { kind: "youtube", embedUrl: youTubeEmbed(url), originalUrl: url };
    }
    return { kind: "unknown", originalUrl: url };
  }

  const host = u.hostname.toLowerCase();

  // YouTube
  if (host.includes("youtube.com") || host.includes("youtu.be")) {
    const id = pickYouTubeId(u);
    if (id) return { kind: "youtube", embedUrl: youTubeEmbed(id), originalUrl: url };
  }

  // Vimeo
  if (host.includes("vimeo.com")) {
    const id = pickVimeoId(u);
    if (id) {
      return {
        kind: "vimeo",
        embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1&title=0&byline=0&portrait=0`,
        originalUrl: url,
      };
    }
    if (host === "player.vimeo.com") {
      return { kind: "vimeo", embedUrl: url, originalUrl: url };
    }
  }
  if (host === "player.vimeo.com") {
    return { kind: "vimeo", embedUrl: url, originalUrl: url };
  }

  // Panda Video: player-vz-<zone>.tv.pandavideo.com.br/embed/?v=<videoId>
  //  também aceita b-vz-<zone>.tv.pandavideo.com.br/<videoId>/playlist.m3u8 (HLS directo)
  if (host.endsWith("pandavideo.com.br") || host.endsWith("pandavideo.com")) {
    // HLS / ficheiro directo
    if (/\.(m3u8|mp4|webm|mov)$/i.test(u.pathname)) {
      return { kind: "file", fileUrl: url, originalUrl: url };
    }
    // Link do dashboard: /#/videos/<id> → converter para embed
    const dashId = url.match(/videos\/([0-9a-f-]{8,})/i)?.[1];
    if (host.startsWith("dashboard.") && dashId) {
      return {
        kind: "panda",
        embedUrl: `https://player.pandavideo.com.br/embed/?v=${dashId}`,
        originalUrl: url,
      };
    }
    // Já é um embed
    if (u.pathname.includes("/embed")) {
      return { kind: "panda", embedUrl: url, originalUrl: url };
    }
    const v = u.searchParams.get("v") ?? u.pathname.split("/").filter(Boolean).pop();
    if (v) {
      return {
        kind: "panda",
        embedUrl: `https://${host.startsWith("player-") ? host : "player.pandavideo.com.br"}/embed/?v=${v}`,
        originalUrl: url,
      };
    }
    return { kind: "panda", embedUrl: url, originalUrl: url };
  }

  // Bunny.net (Stream): iframe.mediadelivery.net/embed/<libId>/<videoId>
  //  or full https:// links; also accept iframe.mediadelivery.net/play/...
  if (host.endsWith("mediadelivery.net") || host.endsWith("b-cdn.net")) {
    // If already an embed url, use as-is.
    if (u.pathname.includes("/embed/")) {
      return { kind: "bunny", embedUrl: url, originalUrl: url };
    }
    // If /play/libId/videoId → convert to /embed/libId/videoId
    if (u.pathname.includes("/play/")) {
      return {
        kind: "bunny",
        embedUrl: url.replace("/play/", "/embed/"),
        originalUrl: url,
      };
    }
    // Direct b-cdn.net file
    if (host.endsWith("b-cdn.net") && /\.(mp4|webm|mov|m3u8)$/i.test(u.pathname)) {
      return { kind: "file", fileUrl: url, originalUrl: url };
    }
    return { kind: "bunny", embedUrl: url, originalUrl: url };
  }

  // Direct file — includes Supabase signed URLs to .mp4 / .webm / .mov
  if (/\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(u.pathname) || url.includes("/storage/v1/object/")) {
    return { kind: "file", fileUrl: url, originalUrl: url };
  }

  // Anything else — best-effort iframe
  return { kind: "iframe", embedUrl: url, originalUrl: url };
}

function pickYouTubeId(u: URL): string | null {
  const v = u.searchParams.get("v");
  if (v) return v;
  const parts = u.pathname.split("/").filter(Boolean);
  const embedIdx = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "live");
  if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
  if (u.hostname.includes("youtu.be") && parts[0]) return parts[0];
  return null;
}

function pickVimeoId(u: URL): string | null {
  const parts = u.pathname.split("/").filter(Boolean);
  const id = parts.find((p) => /^\d+$/.test(p));
  return id ?? null;
}

function youTubeEmbed(id: string) {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1&autoplay=1`;
}
