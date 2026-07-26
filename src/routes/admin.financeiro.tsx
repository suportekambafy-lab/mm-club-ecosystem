import { useEffect, useRef, useState } from "react";
import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";
import { searchBilling } from "@/lib/admin-finance.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/financeiro")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Financeiro — MM Admin" },
      {
        name: "description",
        content:
          "Dashboard financeiro do MM Club: receita, MRR, subscrições, pagamentos, cupões e catálogo.",
      },
      { property: "og:title", content: "Financeiro — MM Admin" },
      {
        property: "og:description",
        content: "Gestão completa da faturação do MM Club.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: FinanceLayout,
});

const TABS: { to: string; label: string; exact?: boolean }[] = [
  { to: "/admin/financeiro", label: "Visão geral", exact: true },
  { to: "/admin/financeiro/subscricoes", label: "Subscrições" },
  { to: "/admin/financeiro/estado", label: "Estado & acessos" },
  { to: "/admin/financeiro/recovery", label: "Recovery" },
  { to: "/admin/financeiro/inteligencia", label: "Intelligence" },


  { to: "/admin/financeiro/receita", label: "Receita" },
  { to: "/admin/financeiro/cupoes", label: "Cupões" },
  { to: "/admin/financeiro/catalogo", label: "Catálogo" },
];

function GlobalSearch() {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const search = useServerFn(searchBilling);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 280);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["billing-search", debounced],
    queryFn: () => search({ data: { term: debounced } }),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Email, nome, ID de subscrição, pagamento ou fatura…"
        className="h-10 w-full rounded-xl border border-border bg-surface-1 pl-9 pr-9 text-sm outline-none ring-primary/40 placeholder:text-muted-foreground focus:ring-2"
      />
      {isFetching ? (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}

      {open && debounced.length >= 2 ? (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-surface-2 shadow-2xl">
          {(data ?? []).length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              {isFetching ? "A procurar…" : "Sem resultados."}
            </p>
          ) : (
            (data ?? []).map((hit) => (
              <button
                key={hit.userId}
                type="button"
                onClick={() => {
                  setOpen(false);
                  setTerm("");
                  navigate({
                    to: "/admin/financeiro/cliente/$userId",
                    params: { userId: hit.userId },
                  });
                }}
                className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-left last:border-0 hover:bg-surface-1"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">
                    {hit.name ?? hit.email ?? hit.userId}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {hit.email ?? hit.userId}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {hit.matchedOn}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function FinanceLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Operações
            </p>
            <h1 className="font-display text-2xl font-semibold md:text-3xl">
              Financeiro
            </h1>
          </div>
          <GlobalSearch />
        </div>

        <nav className="flex flex-wrap gap-1 border-b border-border">
          {TABS.map((t) => {
            const active = t.exact
              ? pathname === t.to
              : pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to as never}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <Outlet />
    </div>
  );
}
