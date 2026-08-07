import { useEffect, useState } from "react";
import { pandaThumbFromUrl } from "@/lib/course-duration";
import { captureHlsFrame } from "@/lib/video-frame";

/**
 * Resolve a Bunny Stream thumbnail from any supported URL.
 *
 * Bunny publishes the thumbnail on the video's dedicated pull zone
 * (vz-*.b-cdn.net) which we don't always know from just the iframe URL.
 * Their public OEmbed endpoint returns it without auth:
 *   https://video.bunnycdn.com/OEmbed?url=<iframe_or_play_url>
 *
 * We cache resolved thumbs in-memory (survives navigations) and in
 * sessionStorage (survives soft reloads) so we only pay the roundtrip once
 * per video.
 */

type Status = "idle" | "loading" | "done" | "error";
const memory = new Map<string, string | null>();

function fromSession(url: string): string | null | undefined {
  try {
    const raw = sessionStorage.getItem(`bunny-thumb::${url}`);
    if (raw === null) return undefined;
    return raw || null;
  } catch {
    return undefined;
  }
}

function toSession(url: string, thumb: string | null) {
  try {
    sessionStorage.setItem(`bunny-thumb::${url}`, thumb ?? "");
  } catch {
    /* ignore quota */
  }
}

function isBunnyEmbed(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "iframe.mediadelivery.net" ||
      u.hostname === "player.mediadelivery.net" ||
      u.hostname.endsWith(".mediadelivery.net") ||
      u.hostname === "video.bunnycdn.com"
    );
  } catch {
    return false;
  }
}

function isPanda(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith("pandavideo.com.br");
  } catch {
    return false;
  }
}


export function useBunnyThumb(url: string | null | undefined): {
  thumb: string | null;
  status: Status;
} {
  const key = (url ?? "").trim();
  const cached = key ? memory.get(key) : undefined;
  const seeded =
    cached !== undefined ? cached : key ? fromSession(key) ?? undefined : undefined;

  const [thumb, setThumb] = useState<string | null>(seeded ?? null);
  const [status, setStatus] = useState<Status>(
    seeded !== undefined ? "done" : "idle",
  );

  useEffect(() => {
    if (!key) {
      setThumb(null);
      setStatus("idle");
      return;
    }
    if (memory.has(key)) {
      setThumb(memory.get(key) ?? null);
      setStatus("done");
      return;
    }
    const fromCache = fromSession(key);
    if (fromCache !== undefined) {
      memory.set(key, fromCache);
      setThumb(fromCache);
      setStatus("done");
      return;
    }
    if (isPanda(key)) {
      const poster = pandaThumbFromUrl(key);
      if (!poster) {
        memory.set(key, null);
        setStatus("done");
        return;
      }
      let cancelledPanda = false;
      setStatus("loading");
      void captureHlsFrame(poster.replace(/thumbnail\.jpg$/, "playlist.m3u8")).then(
        (frame) => {
          if (cancelledPanda) return;
          const resolved = frame ?? poster;
          memory.set(key, resolved);
          setThumb(resolved);
          setStatus("done");
        },
      );
      return () => {
        cancelledPanda = true;
      };
    }
    if (!isBunnyEmbed(key)) {
      memory.set(key, null);
      setStatus("done");
      return;
    }


    let cancelled = false;
    setStatus("loading");
    const oembed = `https://video.bunnycdn.com/OEmbed?url=${encodeURIComponent(key)}`;
    fetch(oembed, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { thumbnail_url?: string } | null) => {
        if (cancelled) return;
        const resolved = data?.thumbnail_url ?? null;
        memory.set(key, resolved);
        toSession(key, resolved);
        setThumb(resolved);
        setStatus("done");
      })
      .catch(() => {
        if (cancelled) return;
        memory.set(key, null);
        toSession(key, null);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { thumb, status };
}
