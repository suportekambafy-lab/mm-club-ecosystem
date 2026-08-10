import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Search, LayoutGrid, List, Sparkles, ArrowRight, Gift, PencilLine } from "lucide-react";
import { listProducts, setProductStatus, analyseProduct } from "@/lib/product-lab.functions";
import { PL_STATUSES, statusLabel, type PlStatus } from "@/lib/product-lab-config";
import { ProductBoard, ProductBoardCard } from "@/components/mm/product-lab/board";
import { ProductDialog } from "@/components/mm/product-lab/product-dialog";
import { MineDialog } from "@/components/mm/product-lab/mine-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_app/ferramentas/product-lab/")({
  head: () => ({
    meta: [
      { title: "MM Product Lab — Mineração e validação de produtos" },
      {
        name: "description",
        content:
          "Encontra, organiza e analisa os teus produtos num só lugar: kanban de estados, Score MM e análise com IA. Grátis para membros do MM Club.",
      },
      { property: "og:title", content: "MM Product Lab — MM Club" },
      { property: "og:description", content: "Encontra, organiza e analisa os teus produtos num só lugar." },
    ],
  }),
  component: ProductLabDashboard,
});

type Product = Record<string, any>;

const sorts = [
  { id: "score-desc", label: "Score maior" },
  { id: "score-asc", label: "Score menor" },
  { id: "recent", label: "Mais recentes" },
  { id: "old", label: "Mais antigos" },
] as const;

function ProductLabDashboard() {
  const fetchProducts = useServerFn(listProducts);
  const { data, isPending } = useQuery({
    queryKey: ["product-lab", "list"],
    queryFn: () => fetchProducts({ data: undefined as never }),
    staleTime: 30_000,
  });
  const products: Product[] = data?.products ?? [];

  const [dialog, setDialog] = useState(false);
  const [mine, setMine] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<PlStatus | "all">("all");
  const [category, setCategory] = useState("all");
  const [source, setSource] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [sort, setSort] = useState<(typeof sorts)[number]["id"]>("recent");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const navigate = useNavigate();

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[],
    [products],
  );
  const sources = useMemo(
    () => Array.from(new Set(products.map((p) => p.source).filter(Boolean))) as string[],
    [products],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = products.filter((p) => {
      if (term) {
        const hay = `${p.name ?? ""} ${p.category ?? ""} ${statusLabel(p.status)}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (status !== "all" && p.status !== status) return false;
      if (category !== "all" && p.category !== category) return false;
      if (source !== "all" && p.source !== source) return false;
      if (minScore > 0 && (p.score ?? 0) < minScore) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "score-desc") return (b.score ?? -1) - (a.score ?? -1);
      if (sort === "score-asc") return (a.score ?? 101) - (b.score ?? 101);
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sort === "recent" ? tb - ta : ta - tb;
    });
    return list;
  }, [products, q, status, category, source, minScore, sort]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of products) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [products]);

  const qc = useQueryClient();
  const move = useServerFn(setProductStatus);
  const moveMutation = useMutation({
    mutationFn: (v: { id: string; status: PlStatus }) => move({ data: v }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["product-lab"] });
      toast.success(`Movido para ${statusLabel(v.status)}`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-8">
      {/* HERO / STATS */}
      <section className="relative overflow-hidden rounded-[2rem] border border-[color:var(--hairline)] bg-surface-1 p-6 md:p-10">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 60% at 100% 0%, oklch(0.82 0.13 82 / 0.16), transparent 62%)" }}
        />
        <div className="relative flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                <Gift className="h-3 w-3" /> Grátis para membros
              </span>
              <h1 className="mt-3 font-display text-4xl leading-[1] text-foreground md:text-5xl">Meu Product Lab</h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
                Encontra, organiza e analisa os teus produtos num só lugar.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setMine(true)} className="rounded-full">
                <Plus className="h-4 w-4" /> Adicionar Produto
              </Button>
              <Button variant="outline" className="rounded-full" onClick={() => setDialog(true)}>
                <PencilLine className="h-4 w-4" /> Adicionar manualmente
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat n={products.length} label="Produtos encontrados" accent />
            <Stat n={counts.analysis ?? 0} label="Em análise" />
            <Stat n={counts.validated ?? 0} label="Validados" />
            <Stat n={counts.testing ?? 0} label="Em teste" />
            <Stat n={counts.winner ?? 0} label="Vencedores" accent />
          </div>
        </div>
      </section>

      {/* FLOW */}
      <section className="hidden overflow-x-auto md:block">
        <div className="flex min-w-fit items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {["Encontrar", "Adicionar", "Organizar", "Avaliar", "Analisar com IA", "Validar", "Testar", "Vencedor"].map(
            (s, i, arr) => (
              <span key={s} className="flex items-center gap-2">
                <span className={cn("rounded-full border border-[color:var(--hairline)] px-3 py-1", i === arr.length - 1 && "border-primary/40 text-primary")}>
                  {s}
                </span>
                {i < arr.length - 1 && <ArrowRight className="h-3 w-3 opacity-40" />}
              </span>
            ),
          )}
        </div>
      </section>

      {/* SEARCH + FILTERS */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Pesquisar por nome, categoria ou estado…"
              className="rounded-full pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="rounded-full border border-[color:var(--hairline)] bg-surface-1 px-3 py-2 text-xs text-foreground"
            >
              {sorts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <div className="flex rounded-full border border-[color:var(--hairline)] p-0.5">
              <button
                onClick={() => setView("kanban")}
                aria-label="Kanban"
                className={cn("rounded-full p-1.5", view === "kanban" ? "bg-primary/15 text-primary" : "text-muted-foreground")}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("list")}
                aria-label="Lista"
                className={cn("rounded-full p-1.5", view === "list" ? "bg-primary/15 text-primary" : "text-muted-foreground")}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Chip active={status === "all"} onClick={() => setStatus("all")}>
            Todos
          </Chip>
          {PL_STATUSES.map((s) => (
            <Chip key={s.id} active={status === s.id} onClick={() => setStatus(s.id)}>
              {s.label}
            </Chip>
          ))}
          {categories.length > 0 && (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-full border border-[color:var(--hairline)] bg-surface-1 px-3 py-1.5"
            >
              <option value="all">Categoria</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {sources.length > 0 && (
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="rounded-full border border-[color:var(--hairline)] bg-surface-1 px-3 py-1.5"
            >
              <option value="all">Fonte</option>
              {sources.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <select
            value={String(minScore)}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="rounded-full border border-[color:var(--hairline)] bg-surface-1 px-3 py-1.5"
          >
            <option value="0">Score mínimo</option>
            {[40, 60, 70, 80, 90].map((s) => (
              <option key={s} value={s}>
                {s}+
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* CONTENT */}
      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState onAdd={() => setMine(true)} />
      ) : view === "kanban" ? (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {PL_STATUSES.map((s) => {
            const items = filtered.filter((p) => p.status === s.id);
            return (
              <div key={s.id} className="w-[260px] shrink-0 sm:w-[300px]">
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{s.label}</p>
                  <span className="text-[11px] text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((p) => (
                    <ProductCard key={p.id} p={p} onMove={(st) => moveMutation.mutate({ id: p.id, status: st })} />
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
                      Vazio
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProductCard key={p.id} p={p} onMove={(st) => moveMutation.mutate({ id: p.id, status: st })} />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Nenhum produto corresponde aos filtros.</p>
          )}
        </div>
      )}

      <MineDialog
        open={mine}
        onOpenChange={setMine}
        onManual={() => setDialog(true)}
        onSaved={(id) => navigate({ to: "/ferramentas/product-lab/$productId", params: { productId: id } })}
      />

      <ProductDialog
        open={dialog}
        onOpenChange={setDialog}
        onSaved={(id) => navigate({ to: "/ferramentas/product-lab/$productId", params: { productId: id } })}
      />
    </div>
  );
}

function Stat({ n, label, accent }: { n: number; label: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-[color:var(--hairline)] bg-background/50 p-4">
      <p className={cn("font-display text-3xl leading-none", accent ? "text-primary" : "text-foreground")}>{n}</p>
      <p className="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 transition",
        active ? "border-primary bg-primary/15 text-primary" : "border-[color:var(--hairline)] text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ProductCard({ p, onMove }: { p: Product; onMove: (s: PlStatus) => void }) {
  const tone = scoreTone(p.score ?? null);
  return (
    <div className="group animate-in fade-in slide-in-from-bottom-1 overflow-hidden rounded-2xl border border-[color:var(--hairline)] bg-surface-1 transition duration-300 hover:border-primary/40 hover:shadow-[0_18px_50px_-30px_oklch(0.82_0.13_82/0.6)]">
      <Link to="/ferramentas/product-lab/$productId" params={{ productId: p.id }} className="flex gap-3 p-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[color:var(--hairline)] bg-background">
          {p.image_url ? (
            <img loading="lazy" decoding="async" src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">sem imagem</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {p.category || "sem categoria"}
            {p.sell_price != null ? ` · ${Number(p.sell_price).toFixed(2)} €` : ""}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <ScoreRing score={p.score ?? null} size={34} compact />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-foreground">
                {p.score != null ? `Score MM ${p.score}/100` : "Sem score"}
              </p>
              <p className={cn("truncate text-[10px]", tone.className)}>{tone.label}</p>
            </div>
          </div>
        </div>
      </Link>
      <div className="flex items-center justify-between gap-2 border-t border-[color:var(--hairline)] px-3 py-2">
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {statusLabel(p.status)} · {new Date(p.created_at).toLocaleDateString("pt-PT")}
        </span>
        <select
          value={p.status}
          onChange={(e) => onMove(e.target.value as PlStatus)}
          className="rounded-full border border-[color:var(--hairline)] bg-background px-2 py-1 text-[10px] text-muted-foreground"
        >
          {PL_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-border bg-surface-1 px-6 py-16 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <Sparkles className="h-6 w-6" />
      </span>
      <h2 className="mt-5 font-display text-2xl text-foreground">Começa a tua mineração.</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Adiciona o primeiro produto e começa a construir a tua biblioteca de oportunidades.
      </p>
      <Button className="mt-6 rounded-full" onClick={onAdd}>
        <Plus className="h-4 w-4" /> Adicionar primeiro produto
      </Button>
    </div>
  );
}
