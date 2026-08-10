import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Sparkles,
  Trash2,
  Plus,
  ExternalLink,
  Info,
  Loader2,
} from "lucide-react";
import {
  getProduct,
  saveScores,
  setProductStatus,
  analyseProduct,
  saveAsset,
  deleteAsset,
  saveCompetitor,
  deleteCompetitor,
  addNote,
  deleteNote,
  deleteProduct,
} from "@/lib/product-lab.functions";
import { PL_CRITERIA, PL_MAX_NOTE, PL_STATUSES, computeScore, statusLabel, type PlStatus } from "@/lib/product-lab-config";
import { ScoreRing } from "@/components/mm/product-lab/score-ring";
import { ProductDialog, productToInput } from "@/components/mm/product-lab/product-dialog";
import { MediaField } from "@/components/mm/media-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { L } from "@/lib/language-guide";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/ferramentas/product-lab/$productId")({
  head: () => ({
    meta: [
      { title: "Produto — MM Product Lab" },
      { name: "description", content: "Ficha completa do produto: economia, critérios MM, análise com IA, criativos e concorrentes." },
      { property: "og:title", content: "MM Product Lab — Ficha de produto" },
      { property: "og:description", content: "Economia, critérios MM, análise com IA, criativos e concorrentes." },
    ],
  }),
  component: ProductDetail,
});

type Row = Record<string, any>;

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-5 md:p-7">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Info2({ label, value, href }: { label: string; value?: string | null; href?: string | null }) {
  return (
    <div className="rounded-2xl border border-[color:var(--hairline)] bg-background/50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">{label}</p>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 break-all text-sm text-primary hover:underline">
          {value || href} <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <p className="mt-1 break-words text-sm text-foreground">{value || "—"}</p>
      )}
    </div>
  );
}

function ProductDetail() {
  const { productId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetch = useServerFn(getProduct);
  const { data, isPending } = useQuery({
    queryKey: ["product-lab", "product", productId],
    queryFn: () => fetch({ data: { id: productId } }),
    staleTime: 15_000,
  });

  const [edit, setEdit] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["product-lab"] });

  const product: Row | undefined = data?.product;
  const scoreRows: Row[] = data?.scores ?? [];
  const values = useMemo(() => {
    const v: Record<string, number> = {};
    for (const s of scoreRows) v[s.criterion] = s.value;
    return v;
  }, [scoreRows]);

  const [draft, setDraft] = useState<Record<string, number> | null>(null);
  const current = draft ?? values;
  const liveScore = computeScore(current);

  const saveScoresFn = useServerFn(saveScores);
  const scoreMutation = useMutation({
    mutationFn: () => saveScoresFn({ data: { id: productId, values: current } }),
    onSuccess: () => {
      setDraft(null);
      invalidate();
      toast.success("Critérios MM guardados");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const moveFn = useServerFn(setProductStatus);
  const moveMutation = useMutation({
    mutationFn: (status: PlStatus) => moveFn({ data: { id: productId, status } }),
    onSuccess: (_r, s) => {
      invalidate();
      toast.success(`Movido para ${statusLabel(s)}`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const analyseFn = useServerFn(analyseProduct);
  const analysis = useMutation({
    mutationFn: () => analyseFn({ data: { id: productId } }),
    onSuccess: () => {
      invalidate();
      toast.success("Análise concluída");
    },
    onError: (e) => toast.error((e as Error).message ?? L.genericError),
  });

  const removeFn = useServerFn(deleteProduct);
  const remove = useMutation({
    mutationFn: () => removeFn({ data: { id: productId } }),
    onSuccess: () => {
      invalidate();
      navigate({ to: "/ferramentas/product-lab" });
    },
  });

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-[2rem]" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }
  if (!product) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">Produto não encontrado.</p>
        <Link to="/ferramentas/product-lab" className="mt-3 inline-block text-sm text-primary">
          Voltar ao Product Lab
        </Link>
      </div>
    );
  }

  const sell = product.sell_price != null ? Number(product.sell_price) : null;
  const cost = product.cost_price != null ? Number(product.cost_price) : null;
  const marginValue = sell != null && cost != null ? sell - cost : null;
  const marginPct = marginValue != null && sell ? Math.round((marginValue / sell) * 100) : null;
  const latest = (data?.analyses ?? [])[0] as Row | undefined;

  return (
    <div className="space-y-6">
      <Link to="/ferramentas/product-lab" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Meu Product Lab
      </Link>

      {/* HEADER */}
      <section className="overflow-hidden rounded-[2rem] border border-[color:var(--hairline)] bg-surface-1">
        <div className="flex flex-col gap-6 p-5 md:flex-row md:items-center md:p-8">
          <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-[color:var(--hairline)] bg-background md:h-36 md:w-36">
            {product.image_url ? (
              <img loading="lazy" decoding="async" src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">sem imagem</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              {product.category || "sem categoria"}
            </p>
            <h1 className="mt-1 font-display text-3xl leading-tight text-foreground md:text-4xl">{product.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {PL_STATUSES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => moveMutation.mutate(s.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition",
                    product.status === s.id
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-[color:var(--hairline)] text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => setEdit(true)}>
                <Pencil className="h-4 w-4" /> {L.edit}
              </Button>
              <Button className="rounded-full" disabled={analysis.isPending} onClick={() => analysis.mutate()}>
                {analysis.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {analysis.isPending ? "A analisar…" : "Analisar com IA"}
              </Button>
              <Button
                variant="ghost"
                className="rounded-full text-muted-foreground"
                onClick={() => {
                  if (confirm(`Eliminar "${product.name}"? ${L.irreversible}`)) remove.mutate();
                }}
              >
                <Trash2 className="h-4 w-4" /> {L.delete}
              </Button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ScoreRing score={product.score ?? null} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Score MM</p>
          </div>
        </div>
      </section>

      {/* 1. INFORMAÇÕES */}
      <Section title="Informações do produto">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Info2 label="Categoria / nicho" value={product.category} />
          <Info2 label="País / mercado" value={product.market} />
          <Info2 label="Onde encontraste" value={product.source} />
          <Info2 label="Fornecedor" value={product.supplier} />
          <Info2 label="Link do fornecedor" value={product.supplier_url} href={product.supplier_url} />
          <Info2 label="Link do produto" value={product.product_url} href={product.product_url} />
          <Info2 label="Link do anúncio" value={product.ad_url} href={product.ad_url} />
          <Info2 label="Criado a" value={new Date(product.created_at).toLocaleString("pt-PT")} />
        </div>
      </Section>

      {/* 2. ECONOMIA */}
      <Section title="Economia">
        <div className="grid gap-3 sm:grid-cols-3">
          <Info2 label="Preço de venda" value={sell != null ? `${sell.toFixed(2)} €` : null} />
          <Info2 label="Custo estimado" value={cost != null ? `${cost.toFixed(2)} €` : null} />
          <Info2
            label="Margem estimada"
            value={marginValue != null ? `${marginValue.toFixed(2)} € · ${marginPct}%` : null}
          />
        </div>
      </Section>

      {/* 3. CRITÉRIOS MM */}
      <Section
        title="Critérios MM"
        action={
          <div className="flex items-center gap-3">
            <span className="font-display text-lg text-primary">{liveScore ?? "—"}<span className="text-xs text-muted-foreground">/100</span></span>
            <Button
              size="sm"
              className="rounded-full"
              disabled={scoreMutation.isPending || draft === null}
              onClick={() => scoreMutation.mutate()}
            >
              {scoreMutation.isPending ? L.loading : L.save}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {PL_CRITERIA.map((c) => (
            <div key={c.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.help}</p>
                </div>
                <span className="font-display text-base text-primary">
                  {current[c.id] ?? 0}
                  <span className="text-[10px] text-muted-foreground">/{PL_MAX_NOTE}</span>
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={PL_MAX_NOTE}
                step={1}
                value={current[c.id] ?? 0}
                onChange={(e) => setDraft({ ...current, [c.id]: Number(e.target.value) })}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
              />
            </div>
          ))}
        </div>
      </Section>

      {/* 4. ANÁLISE IA */}
      <Section
        title="Análise IA"
        action={
          <Button size="sm" variant="outline" className="rounded-full" disabled={analysis.isPending} onClick={() => analysis.mutate()}>
            {analysis.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {analysis.isPending ? "A analisar…" : "Analisar com IA"}
          </Button>
        }
      >
        {analysis.isPending && (
          <div className="mb-4 space-y-2 rounded-2xl border border-primary/25 bg-primary/5 p-5">
            <p className="text-sm text-primary">Estamos a analisar esta oportunidade…</p>
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        )}
        {analysis.isError && (
          <p className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Não foi possível gerar a análise. {L.retry}.
          </p>
        )}
        {latest ? (
          <>
            {latest.recommendation && (
              <p className="mb-4 inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                {latest.recommendation}
              </p>
            )}
            <div className="space-y-1.5 text-sm leading-relaxed text-foreground">
              {String(latest.content)
                .split("\n")
                .filter((l) => l.trim())
                .map((line, i) =>
                  line.startsWith("###") ? (
                    <h3 key={i} className="pt-3 font-display text-base text-primary">
                      {line.replace(/^#+\s*/, "")}
                    </h3>
                  ) : (
                    <p key={i} className="text-muted-foreground">
                      {line.replace(/^[-*]\s*/, "• ").replace(/\*\*/g, "")}
                    </p>
                  ),
                )}
            </div>
            <p className="mt-5 flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Análise gerada por IA. Utiliza como apoio à decisão e valida sempre no mercado.
            </p>
            {(data?.analyses ?? []).length > 1 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {(data?.analyses ?? []).length} análises guardadas · última a{" "}
                {new Date(latest.created_at).toLocaleString("pt-PT")}
              </p>
            )}
          </>
        ) : (
          !analysis.isPending && (
            <p className="text-sm text-muted-foreground">
              Ainda sem análise. Preenche os critérios MM e pede uma análise para apoio à decisão.
            </p>
          )
        )}
      </Section>

      {/* 5. CRIATIVOS */}
      <CreativeVault productId={productId} assets={data?.assets ?? []} onChange={invalidate} />

      {/* 6. CONCORRENTES */}
      <Competitors productId={productId} rows={data?.competitors ?? []} onChange={invalidate} />

      {/* 7. OBSERVAÇÕES */}
      <Notes productId={productId} rows={data?.notes ?? []} baseNote={product.notes} onChange={invalidate} />

      {/* 8. HISTÓRICO */}
      <Section title="Histórico">
        <ol className="space-y-2">
          {(data?.history ?? []).map((h: Row) => (
            <li key={h.id} className="flex items-center justify-between gap-3 border-b border-[color:var(--hairline)] pb-2 text-sm last:border-0">
              <span className="text-foreground">
                {h.event === "created" && "Produto adicionado"}
                {h.event === "updated" && "Informações atualizadas"}
                {h.event === "status" && `Movido para ${statusLabel(h.detail)}`}
                {h.event === "ai" && `Análise IA — ${h.detail}`}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(h.created_at).toLocaleString("pt-PT")}
              </span>
            </li>
          ))}
          {(data?.history ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem eventos.</p>}
        </ol>
      </Section>

      <ProductDialog open={edit} onOpenChange={setEdit} initial={productToInput(product)} />
    </div>
  );
}

function CreativeVault({ productId, assets, onChange }: { productId: string; assets: Row[]; onChange: () => void }) {
  const save = useServerFn(saveAsset);
  const del = useServerFn(deleteAsset);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [kind, setKind] = useState<"image" | "video" | "link" | "screenshot">("image");

  const add = useMutation({
    mutationFn: () => save({ data: { product_id: productId, kind, url: url || null, title: title || null, notes: notes || null } }),
    onSuccess: () => {
      setUrl(""); setTitle(""); setNotes(""); setOpen(false);
      onChange();
      toast.success("Referência guardada");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { onChange(); toast.success("Referência eliminada"); },
  });

  return (
    <Section
      title="Creative Vault"
      action={
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOpen((o) => !o)}>
          <Plus className="h-3.5 w-3.5" /> {L.add}
        </Button>
      }
    >
      {open && (
        <div className="mb-5 space-y-3 rounded-2xl border border-[color:var(--hairline)] bg-background/50 p-4">
          <div className="flex flex-wrap gap-2">
            {(["image", "video", "screenshot", "link"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs",
                  kind === k ? "border-primary bg-primary/15 text-primary" : "border-[color:var(--hairline)] text-muted-foreground",
                )}
              >
                {k === "image" ? "Imagem" : k === "video" ? "Vídeo" : k === "screenshot" ? "Screenshot" : "Link"}
              </button>
            ))}
          </div>
          {kind === "link" ? (
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          ) : (
            <MediaField
              label="Ficheiro"
              bucket="studio-media"
              keyPrefix={`product-lab/${productId}`}
              value={url}
              onChange={setUrl}
              accept={kind === "video" ? "video/*" : "image/*"}
            />
          )}
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (opcional)" />
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações (opcional)" />
          <Button size="sm" className="rounded-full" disabled={add.isPending || (!url && !notes)} onClick={() => add.mutate()}>
            {add.isPending ? L.loading : L.save}
          </Button>
        </div>
      )}
      {assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem referências. Guarda anúncios, screenshots e vídeos que te inspirem.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => (
            <div key={a.id} className="overflow-hidden rounded-2xl border border-[color:var(--hairline)] bg-background/50">
              {a.url && a.kind === "video" ? (
                <video src={a.url} controls preload="metadata" className="aspect-video w-full bg-black object-contain" />
              ) : a.url && a.kind !== "link" ? (
                <img loading="lazy" decoding="async" src={a.url} alt={a.title ?? "referência"} className="aspect-video w-full object-cover" />
              ) : null}
              <div className="space-y-1 p-3">
                <p className="text-sm text-foreground">{a.title || (a.kind === "link" ? "Link" : "Referência")}</p>
                {a.url && (
                  <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-xs text-primary">
                    abrir <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
                <button onClick={() => remove.mutate(a.id)} className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" /> {L.delete}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function Competitors({ productId, rows, onChange }: { productId: string; rows: Row[]; onChange: () => void }) {
  const save = useServerFn(saveCompetitor);
  const del = useServerFn(deleteCompetitor);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [shot, setShot] = useState("");
  const [notes, setNotes] = useState("");

  const add = useMutation({
    mutationFn: () => save({ data: { product_id: productId, name: name.trim(), url: url || null, screenshot_url: shot || null, notes: notes || null } }),
    onSuccess: () => {
      setName(""); setUrl(""); setShot(""); setNotes(""); setOpen(false);
      onChange();
      toast.success("Concorrente guardado");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { onChange(); toast.success("Concorrente eliminado"); },
  });

  return (
    <Section
      title="Concorrentes"
      action={
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOpen((o) => !o)}>
          <Plus className="h-3.5 w-3.5" /> {L.add}
        </Button>
      }
    >
      {open && (
        <div className="mb-5 space-y-3 rounded-2xl border border-[color:var(--hairline)] bg-background/50 p-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          <MediaField label="Screenshot" bucket="studio-media" keyPrefix={`product-lab/${productId}/concorrentes`} value={shot} onChange={setShot} />
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações" />
          <Button size="sm" className="rounded-full" disabled={!name.trim() || add.isPending} onClick={() => add.mutate()}>
            {add.isPending ? L.loading : L.save}
          </Button>
        </div>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem concorrentes guardados.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((c) => (
            <div key={c.id} className="flex gap-3 rounded-2xl border border-[color:var(--hairline)] bg-background/50 p-3">
              {c.screenshot_url && (
                <img loading="lazy" decoding="async" src={c.screenshot_url} alt={c.name} className="h-16 w-16 rounded-xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                {c.url && (
                  <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-xs text-primary">
                    {c.url} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {c.notes && <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>}
                <button onClick={() => remove.mutate(c.id)} className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" /> {L.delete}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function Notes({ productId, rows, baseNote, onChange }: { productId: string; rows: Row[]; baseNote?: string | null; onChange: () => void }) {
  const save = useServerFn(addNote);
  const del = useServerFn(deleteNote);
  const [body, setBody] = useState("");
  const add = useMutation({
    mutationFn: () => save({ data: { product_id: productId, body: body.trim() } }),
    onSuccess: () => { setBody(""); onChange(); toast.success("Observação guardada"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: onChange,
  });

  return (
    <Section title="Observações">
      {baseNote && <p className="mb-4 rounded-2xl border border-[color:var(--hairline)] bg-background/50 p-4 text-sm text-muted-foreground">{baseNote}</p>}
      <div className="space-y-3">
        {rows.map((n) => (
          <div key={n.id} className="flex items-start justify-between gap-3 rounded-2xl border border-[color:var(--hairline)] bg-background/50 p-4">
            <div>
              <p className="text-sm text-foreground">{n.body}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-PT")}</p>
            </div>
            <button onClick={() => remove.mutate(n.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Nova observação…" />
        <Button size="sm" className="rounded-full" disabled={!body.trim() || add.isPending} onClick={() => add.mutate()}>
          {add.isPending ? L.loading : L.add}
        </Button>
      </div>
    </Section>
  );
}
