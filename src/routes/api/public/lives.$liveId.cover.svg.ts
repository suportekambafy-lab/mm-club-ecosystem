import { createFileRoute } from "@tanstack/react-router";

/**
 * Auto-generated MM Club cover for a live session.
 * Returns an SVG rendered with the live title, styled with MM Club tokens.
 * Public: no auth (covers are shown on public listings when applicable).
 */
export const Route = createFileRoute("/api/public/lives/$liveId/cover/svg")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const liveId = params.liveId;
        let title = "MM Club · Live";
        let startsAt: string | null = null;
        try {
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );
          const { data } = await supabaseAdmin
            .from("lives")
            .select("title, starts_at")
            .eq("id", liveId)
            .maybeSingle();
          if (data?.title) title = data.title;
          startsAt = data?.starts_at ?? null;
        } catch {
          // fall through with defaults
        }

        const svg = renderCoverSvg(title, startsAt);
        return new Response(svg, {
          headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control":
              "public, max-age=300, s-maxage=600, stale-while-revalidate=86400",
          },
        });
      },
    },
  },
});

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapTitle(title: string, maxCharsPerLine = 22, maxLines = 3): string[] {
  const words = title.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length > maxCharsPerLine && current) {
      lines.push(current);
      current = w;
    } else {
      current = next;
    }
    if (lines.length === maxLines - 1 && current.length > maxCharsPerLine) {
      lines.push(current.slice(0, maxCharsPerLine - 1) + "…");
      current = "";
      break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function renderCoverSvg(title: string, startsAt: string | null): string {
  const W = 1600;
  const H = 900;
  const lines = wrapTitle(title, 18, 3);
  const fontSize = lines.length >= 3 ? 104 : lines.length === 2 ? 126 : 156;
  const lineHeight = fontSize * 1.05;
  const totalHeight = lines.length * lineHeight;
  const startY = H / 2 - totalHeight / 2 + fontSize * 0.8;

  const dateStr = startsAt
    ? new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(startsAt))
    : "";

  const titleTspans = lines
    .map(
      (l, i) =>
        `<tspan x="120" y="${startY + i * lineHeight}">${escapeXml(l)}</tspan>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#040404"/>
      <stop offset="58%" stop-color="#080706"/>
      <stop offset="100%" stop-color="#1a1207"/>
    </linearGradient>
    <radialGradient id="glow" cx="76%" cy="16%" r="62%">
      <stop offset="0%" stop-color="#f5c35d" stop-opacity="0.32"/>
      <stop offset="52%" stop-color="#f2b750" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#f2b750" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="16%" cy="95%" r="60%">
      <stop offset="0%" stop-color="#d7a043" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#e8a94a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#f6d38a"/>
      <stop offset="45%" stop-color="#f2b750"/>
      <stop offset="100%" stop-color="#c98a2b"/>
    </linearGradient>
    <pattern id="grid" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
      <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#f2b750" stroke-opacity="0.05" stroke-width="1"/>
    </pattern>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="badgeGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="18" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>

  <rect width="${W}" height="${H}" fill="#000" opacity="0.25"/>
  <path d="M 1040 -80 C 1280 70 1390 230 1680 190" fill="none" stroke="#f5c35d" stroke-opacity="0.24" stroke-width="120"/>
  <path d="M -80 780 C 280 680 460 850 780 710" fill="none" stroke="#c98a2b" stroke-opacity="0.2" stroke-width="90"/>

  <!-- eyebrow -->
  <g font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-weight="800" filter="url(#badgeGlow)">
    <rect x="120" y="96" width="318" height="64" rx="32" fill="#f33745"/>
    <circle cx="156" cy="128" r="10" fill="#ffffff"/>
    <text x="184" y="139" font-size="27" letter-spacing="8" fill="#ffffff">AO VIVO AGORA</text>
    <circle cx="156" cy="128" r="10" fill="#ffffff">
      <animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite"/>
    </circle>
  </g>

  <!-- title -->
  <text
    font-family="Inter, ui-sans-serif, system-ui, sans-serif"
    font-weight="850"
    font-size="${fontSize}"
    fill="#faf7f0"
    filter="url(#softGlow)"
    style="letter-spacing:0px"
  >${titleTspans}</text>

  <!-- underline -->
  <rect x="120" y="${startY + totalHeight - fontSize * 0.2 + 30}" width="180" height="6" rx="3" fill="url(#gold)"/>

  ${
    dateStr
      ? `<text x="120" y="${H - 130}" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="30" fill="#c9b78a" letter-spacing="2">${escapeXml(dateStr)}</text>`
      : ""
  }

  <text x="${W - 120}" y="${H - 130}" text-anchor="end" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="24" fill="#f2b750" font-weight="700" letter-spacing="6">MM CLUB</text>
</svg>`;
}
