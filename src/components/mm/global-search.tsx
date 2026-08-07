import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildSearchIndex,
  searchLabel,
  type SearchItem,
  type SearchType,
} from "@/lib/search-index";

const ORDER: SearchType[] = ["course", "expert", "tool", "live", "event"];

function score(item: SearchItem, q: string) {
  const title = item.title.toLowerCase();
  if (title.startsWith(q)) return 0;
  if (title.includes(q)) return 1;
  if (item.subtitle.toLowerCase().includes(q)) return 2;
  if (item.keywords.includes(q)) return 3;
  return -1;
}

export function GlobalSearch({ variant = "bar" }: { variant?: "bar" | "icon" }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const index = useMemo(() => buildSearchIndex(), []);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const q = term.trim().toLowerCase();

  const results = useMemo(() => {
    const base = q
      ? index
          .map((i) => ({ i, s: score(i, q) }))
          .filter((r) => r.s >= 0)
          .sort((a, b) => a.s - b.s)
          .map((r) => r.i)
      : index;
    return base.slice(0, q ? 24 : 12);
  }, [index, q]);

  const groups = useMemo(
    () =>
      ORDER.map((type) => ({
        type,
        items: results.filter((r) => r.type === type),
      })).filter((g) => g.items.length > 0),
    [results],
  );

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => setActive(0), [q, open]);

  function go(item: SearchItem) {
    setOpen(false);
    setTerm("");
    navigate({ to: item.href });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      const item = flat[active];
      if (item) {
        e.preventDefault();
        go(item);
      }
    }
  }

  return (
    <div
      ref={wrapRef}
      className={cn("relative h-10", variant === "bar" ? "w-full max-w-md" : "w-10")}
    >
      {variant === "icon" && !open ? (
        <button
          type="button"
          aria-label="Pesquisar"
          onClick={() => {
            setOpen(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-muted-foreground transition hover:text-foreground"
        >
          <Search className="h-4 w-4" />
        </button>
      ) : (
        <div
          className={cn(
            "absolute top-0 z-50 overflow-hidden rounded-2xl border border-border bg-surface-1",
            variant === "icon"
              ? open
                ? "right-0 w-[min(560px,88vw)]"
                : "left-0 w-72"
              : open
                ? "left-1/2 w-[min(680px,92vw)] -translate-x-1/2 lg:w-[min(760px,70vw)]"
                : "left-0 right-0",
          )}
        >
          <div className="flex h-10 items-center gap-2.5 px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder="Pesquisar no MM Club…"
              aria-label="Pesquisar no MM Club"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {term ? (
              <button
                type="button"
                aria-label="Limpar"
                onClick={() => {
                  setTerm("");
                  inputRef.current?.focus();
                }}
                className="text-muted-foreground transition hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <kbd className="hidden rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline-flex">
                ⌘K
              </kbd>
            )}
          </div>

          {open && (
            <div className="max-h-[min(58vh,420px)] overflow-y-auto overscroll-contain border-t border-border/60 p-1.5">

          {flat.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Sem resultados para “{term.trim()}”.
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.type} className="py-1">
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  {searchLabel(g.type)}
                </p>
                {g.items.map((item) => {
                  const i = flat.indexOf(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(item)}
                      className={cn(
                        "flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left transition",
                        i === active ? "bg-surface-2" : "hover:bg-surface-2/60",
                      )}
                    >
                      <span className="line-clamp-1 text-sm text-foreground">{item.title}</span>
                      {item.subtitle ? (
                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          {item.subtitle}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
            </div>
          )}
        </div>
      )}
    </div>

  );
}
