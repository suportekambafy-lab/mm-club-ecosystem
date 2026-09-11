import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronDown, PlayCircle, Radio } from "lucide-react";
import { listLivesAuthed } from "@/lib/lives.functions";
import { resolveLiveCoverUrl } from "@/lib/live-cover-url";

type Live = Awaited<ReturnType<typeof listLivesAuthed>>[number];

/** Título das lives que pertencem ao desafio (match tolerante a acentos/variações). */
const CHALLENGE_MATCH = /desafio\s+primeira\s+venda/i;

export const CHALLENGE_MODULE_TITLE = "Lives do Desafio Primeira Venda";

function isChallengeReplay(l: Live) {
  return (
    CHALLENGE_MATCH.test(l.title ?? "") &&
    (l.status === "published" || l.status === "ended")
  );
}

/**
 * Módulo dinâmico: agrupa as gravações das lives do Desafio Primeira Venda
 * dentro do curso, mantendo o replay a tocar na página da live (tokens assinados).
 */
export function ChallengeLivesModule({ index }: { index: number }) {
  const [lives, setLives] = useState<Live[] | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let alive = true;
    listLivesAuthed()
      .then((rows) => {
        if (alive) setLives((rows as Live[]).filter(isChallengeReplay));
      })
      .catch(() => {
        if (alive) setLives([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!lives || lives.length === 0) return null;

  const cover = resolveLiveCoverUrl(lives[0]?.cover_url ?? null);

  return (
    <div className="overflow-hidden rounded-xl bg-surface-1 ring-1 ring-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 border-b border-border px-4 py-4 text-left transition hover:bg-surface-2/50 sm:px-5"
        aria-expanded={open}
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />
        {cover ? (
          <span
            aria-hidden
            className="h-10 w-16 shrink-0 rounded-lg border border-border bg-surface-2 bg-cover bg-center"
            style={{ backgroundImage: `url("${cover}")` }}
          />
        ) : (
          <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-primary">
            <Radio className="h-4 w-4" />
          </span>
        )}
        <div className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-primary">
            Módulo {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="truncate font-display text-base text-foreground">
            {CHALLENGE_MODULE_TITLE}
          </h3>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{lives.length}</span>
      </button>

      {open && (
        <ul className="divide-y divide-border">
          {lives.map((l) => {
            const thumb = resolveLiveCoverUrl(l.cover_url);
            const dateStr = new Intl.DateTimeFormat("pt-PT", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }).format(new Date(l.starts_at));
            return (
              <li key={l.id}>
                <Link
                  to="/lives/$liveId"
                  params={{ liveId: l.id }}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2/50 sm:px-5"
                >
                  <span
                    aria-hidden
                    className="flex h-9 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 bg-cover bg-center text-primary"
                    style={thumb ? { backgroundImage: `url("${thumb}")` } : undefined}
                  >
                    {!thumb && <PlayCircle className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{l.title}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <CalendarDays className="h-3 w-3" /> {dateStr} · Replay
                    </span>
                  </span>
                  <PlayCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
