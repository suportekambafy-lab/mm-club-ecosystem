import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Sparkles, GripVertical, Loader2, Store, Users } from "lucide-react";
import { PL_STATUSES, statusLabel, scoreTone, type PlStatus } from "@/lib/product-lab-config";
import { ScoreRing } from "@/components/mm/product-lab/score-ring";
import { cn } from "@/lib/utils";

export type PlProduct = Record<string, any>;

const COLUMN_ACCENT: Record<PlStatus, string> = {
  found: "oklch(0.72 0.02 250)",
  analysis: "oklch(0.78 0.12 240)",
  validated: "oklch(0.78 0.14 150)",
  testing: "oklch(0.82 0.13 82)",
  winner: "oklch(0.85 0.16 95)",
  rejected: "oklch(0.62 0.08 25)",
};

function recBadge(rec: string | null | undefined) {
  if (rec === "Vale a pena aprofundar") return { label: "Aprofundar", cls: "border-primary/40 text-primary" };
  if (rec === "Precisa de mais validação")
    return { label: "Validar mais", cls: "border-[color:var(--hairline)] text-foreground" };
  if (rec === "Baixo potencial neste momento")
    return { label: "Baixo potencial", cls: "border-[color:var(--hairline)] text-muted-foreground" };
  return null;
}

function margin(p: PlProduct) {
  if (p.sell_price == null || p.cost_price == null) return null;
  const sell = Number(p.sell_price);
  const cost = Number(p.cost_price);
  if (!Number.isFinite(sell) || !Number.isFinite(cost) || sell <= 0) return null;
  return Math.round(((sell - cost) / sell) * 100);
}

export function ProductBoardCard({
  p,
  onMove,
  onAnalyse,
  analysing,
  dragging,
  handleProps,
}: {
  p: PlProduct;
  onMove?: (s: PlStatus) => void;
  onAnalyse?: () => void;
  analysing?: boolean;
  dragging?: boolean;
  handleProps?: Record<string, unknown>;
}) {
  const tone = scoreTone(p.score ?? null);
  const rec = recBadge(p.recommendation);
  const m = margin(p);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[color:var(--hairline)] bg-surface-1 transition",
        dragging
          ? "rotate-[1.5deg] border-primary/50 shadow-[0_24px_60px_-24px_oklch(0.82_0.13_82/0.55)]"
          : "hover:border-primary/40",
      )}
    >
      <div className="flex gap-2 p-3">
        <button
          {...handleProps}
          aria-label="Arrastar produto"
          className="mt-0.5 -ml-1 flex h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Link
          to="/ferramentas/product-lab/$productId"
          params={{ productId: p.id }}
          className="flex min-w-0 flex-1 gap-3"
        >
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[color:var(--hairline)] bg-background">
            {p.image_url ? (
              <img loading="lazy" decoding="async" src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                sem imagem
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {p.category || "sem categoria"}
              {p.sell_price != null ? ` · ${Number(p.sell_price).toFixed(2)} €` : ""}
              {m != null ? ` · ${m}% margem` : ""}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <ScoreRing score={p.score ?? null} size={30} compact />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-foreground">
                  {p.score != null ? `Score MM ${p.score}/100` : "Sem score"}
                </p>
                <p className={cn("truncate text-[10px]", tone.className)}>{tone.label}</p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2 text-[10px] text-muted-foreground">
        {p.supplier && (
          <span className="inline-flex max-w-[140px] items-center gap-1 truncate rounded-full border border-[color:var(--hairline)] px-2 py-0.5">
            <Store className="h-3 w-3 shrink-0" /> <span className="truncate">{p.supplier}</span>
          </span>
        )}
        {(p.competitors_count ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--hairline)] px-2 py-0.5">
            <Users className="h-3 w-3" /> {p.competitors_count} concorrente{p.competitors_count > 1 ? "s" : ""}
          </span>
        )}
        {rec ? (
          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5", rec.cls)}>
            {rec.label}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-[color:var(--hairline)] px-2 py-0.5">
            Ainda não analisado
          </span>
        )}
      </div>

      {(onMove || onAnalyse) && (
        <div className="flex items-center justify-between gap-2 border-t border-[color:var(--hairline)] px-3 py-2">
          {onAnalyse ? (
            <button
              onClick={onAnalyse}
              disabled={analysing}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary disabled:opacity-60"
            >
              {analysing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {analysing ? "A analisar…" : "Analisar com IA"}
            </button>
          ) : (
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {statusLabel(p.status)}
            </span>
          )}
          {onMove && (
            <select
              value={p.status}
              onChange={(e) => onMove(e.target.value as PlStatus)}
              aria-label="Mover para"
              className="rounded-full border border-[color:var(--hairline)] bg-background px-2 py-1 text-[10px] text-muted-foreground"
            >
              {PL_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  Mover para {s.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}

function DraggableCard(props: {
  p: PlProduct;
  onMove: (s: PlStatus) => void;
  onAnalyse: () => void;
  analysing?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: props.p.id });
  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 30 } : undefined}
      className={cn("animate-in fade-in", isDragging && "opacity-40")}
    >
      <ProductBoardCard
        p={props.p}
        onMove={props.onMove}
        onAnalyse={props.onAnalyse}
        analysing={props.analysing}
        handleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function Column({
  status,
  label,
  items,
  onMove,
  onAnalyse,
  analysingId,
}: {
  status: PlStatus;
  label: string;
  items: PlProduct[];
  onMove: (id: string, s: PlStatus) => void;
  onAnalyse: (id: string) => void;
  analysingId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="w-[272px] shrink-0 sm:w-[304px]">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: COLUMN_ACCENT[status] }} />
          {label}
        </p>
        <span className="rounded-full border border-[color:var(--hairline)] px-2 py-0.5 text-[10px] text-muted-foreground">
          {items.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[140px] space-y-2 rounded-3xl border p-2 transition",
          isOver
            ? "border-primary/50 bg-primary/[0.06]"
            : "border-[color:var(--hairline)] bg-background/40",
        )}
      >
        {items.map((p) => (
          <DraggableCard
            key={p.id}
            p={p}
            onMove={(s) => onMove(p.id, s)}
            onAnalyse={() => onAnalyse(p.id)}
            analysing={analysingId === p.id}
          />
        ))}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
            Larga um produto aqui
          </div>
        )}
      </div>
    </div>
  );
}

export function ProductBoard({
  products,
  onMove,
  onAnalyse,
  analysingId,
}: {
  products: PlProduct[];
  onMove: (id: string, status: PlStatus) => void;
  onAnalyse: (id: string) => void;
  analysingId: string | null;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const active = products.find((p) => p.id === activeId) ?? null;

  const handleStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const over = e.over?.id ? String(e.over.id) : null;
    if (!over) return;
    const product = products.find((p) => p.id === String(e.active.id));
    if (!product || product.status === over) return;
    onMove(product.id, over as PlStatus);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleStart}
      onDragEnd={handleEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
        {PL_STATUSES.map((s) => (
          <Column
            key={s.id}
            status={s.id}
            label={s.label}
            items={products.filter((p) => p.status === s.id)}
            onMove={onMove}
            onAnalyse={onAnalyse}
            analysingId={analysingId}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22,1,0.36,1)" }}>
        {active ? (
          <div className="w-[272px] sm:w-[304px]">
            <ProductBoardCard p={active} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
