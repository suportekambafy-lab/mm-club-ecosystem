import { createFileRoute } from "@tanstack/react-router";

/**
 * Auto-generated MM Club cover for a live session.
 * Returns an SVG rendered with the live title, styled with MM Club tokens.
 * Public: no auth (covers are shown on public listings when applicable).
 */
export const Route = createFileRoute("/api/public/lives/$liveId/cover.svg")({
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
  const lines = wrapTitle(title, 20, 3);
  const fontSize = lines.length >= 3 ? 92 : lines.length === 2 ? 110 : 132;
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
      <stop offset="0%" stop-color="#0b0906"/>
      <stop offset="55%" stop-color="#141008"/>
      <stop offset="100%" stop-color="#1e1608"/>
    </linearGradient>
    <radialGradient id="glow" cx="18%" cy="18%" r="55%">
      <stop offset="0%" stop-color="#f2b750" stop-opacity="0.35"/>
      <stop offset="60%" stop-color="#f2b750" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#f2b750" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="90%" cy="95%" r="55%">
      <stop offset="0%" stop-color="#e8a94a" stop-opacity="0.25"/>
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
      <feGaussianBlur stdDeviation="6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>

  <!-- diagonal accent -->
  <path d="M ${W - 480} 0 L ${W} 0 L ${W} 60 L ${W - 420} 60 Z" fill="url(#gold)" opacity="0.9"/>
  <path d="M 0 ${H - 60} L 520 ${H - 60} L 460 ${H} L 0 ${H} Z" fill="url(#gold)" opacity="0.85"/>

  <!-- eyebrow -->
  <g font-family="Inter, ui-sans-serif, system-ui, sans-serif" fill="#f2b750" font-weight="600">
    <text x="120" y="140" font-size="26" letter-spacing="8">MM CLUB · AO VIVO</text>
    <circle cx="96" cy="132" r="9" fill="#ef4444"/>
    <circle cx="96" cy="132" r="9" fill="#ef4444">
      <animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite"/>
    </circle>
  </g>

  <!-- title -->
  <text
    font-family="'Playfair Display', 'Cormorant Garamond', Georgia, serif"
    font-weight="700"
    font-size="${fontSize}"
    fill="#faf7f0"
    filter="url(#softGlow)"
    style="letter-spacing:-2px"
  >${titleTspans}</text>

  <!-- underline -->
  <rect x="120" y="${startY + totalHeight - fontSize * 0.2 + 30}" width="180" height="6" rx="3" fill="url(#gold)"/>

  ${
    dateStr
      ? `<text x="120" y="${H - 130}" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="30" fill="#c9b78a" letter-spacing="2">${escapeXml(dateStr)}</text>`
      : ""
  }

  <text x="${W - 120}" y="${H - 130}" text-anchor="end" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="24" fill="#f2b750" font-weight="600" letter-spacing="6">MMCLUB.ONLINE</text>
</svg>`;
}
