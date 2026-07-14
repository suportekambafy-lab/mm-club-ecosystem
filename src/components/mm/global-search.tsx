import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  buildSearchIndex,
  searchLabel,
  type SearchItem,
  type SearchType,
} from "@/lib/search-index";

export function GlobalSearch({ variant = "bar" }: { variant?: "bar" | "icon" }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const index = useMemo(() => buildSearchIndex(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const grouped = useMemo(() => {
    const g: Record<SearchType, SearchItem[]> = {
      course: [],
      expert: [],
      tool: [],
      live: [],
      event: [],
    };
    for (const item of index) g[item.type].push(item);
    return g;
  }, [index]);

  const order: SearchType[] = ["course", "expert", "tool", "live", "event"];

  return (
    <>
      <button
        type="button"
        aria-label="Pesquisar"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex h-10 items-center text-sm text-muted-foreground transition hover:bg-surface-2/60 hover:text-foreground",
          variant === "icon"
            ? "w-10 justify-center rounded-full bg-surface-2"
            : "w-full max-w-md gap-2.5 rounded-full border border-border bg-surface-1/60 px-4 hover:border-[color:var(--hairline)]",
        )}
      >
        <Search className="h-4 w-4" />
        {variant === "bar" && (
          <>
            <span className="flex-1 text-left">Pesquisar no MM Club…</span>
            <kbd className="hidden rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline-flex">
              ⌘K
            </kbd>
          </>
        )}
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Pesquisa cursos, especialistas, ferramentas, lives, eventos…" />
        <CommandList>
          <CommandEmpty>Sem resultados.</CommandEmpty>
          {order.map((type) =>
            grouped[type].length ? (
              <CommandGroup key={type} heading={searchLabel(type)}>
                {grouped[type].map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.title} ${item.subtitle} ${item.keywords}`}
                    onSelect={() => {
                      setOpen(false);
                      navigate({ to: item.href });
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm text-foreground">{item.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.subtitle}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null,
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
