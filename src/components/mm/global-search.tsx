import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
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

export function GlobalSearch() {
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
        onClick={() => setOpen(true)}
        className="group flex h-10 w-full max-w-md items-center gap-2.5 rounded-full border border-border bg-surface-1/60 px-4 text-sm text-muted-foreground transition hover:border-[color:var(--hairline)] hover:bg-surface-2/60"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Pesquisar no MM Club…</span>
        <kbd className="hidden rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline-flex">
          ⌘K
        </kbd>
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
