import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Wand2, Download, RefreshCcw, Check } from "lucide-react";
import { generateImages } from "@/lib/studio.functions";
import { IMAGE_STYLES, IMAGE_FORMATS, type ImageStyle, type ImageFormat, STUDIO_COSTS } from "@/lib/studio-config";
import { useStudio } from "@/lib/studio-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/ferramentas/studio/imagens")({
  component: ImagensPage,
});

type Asset = { id: string; url: string };

function ImagensPage() {
  const { products, balance, refresh } = useStudio();
  const [productId, setProductId] = useState<string | null>(null);
  const [style, setStyle] = useState<ImageStyle | null>(null);
  const [format, setFormat] = useState<ImageFormat | null>(null);
  const [notes, setNotes] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fn = useServerFn(generateImages);
  const mutation = useMutation({
    mutationFn: (input: { style: ImageStyle; format: ImageFormat; productId: string | null; notes: string }) =>
      fn({
        data: {
          style: input.style,
          format: input.format,
          productId: input.productId,
          notes: input.notes || undefined,
          count: 4,
        },
      }),
    onSuccess: (data) => {
      setAssets(data.assets);
      setError(null);
      refresh();
    },
    onError: (e) => setError((e as Error).message),
  });

  const canGenerate = Boolean(style && format) && !mutation.isPending;
  const cost = STUDIO_COSTS.imageBatch;
  const insufficient = balance < cost;

  const handleGenerate = () => {
    if (!style || !format) return;
    setAssets([]);
    setError(null);
    mutation.mutate({ style, format, productId, notes });
  };

  return (
    <div className="space-y-8">
      {/* STEP 1 — PRODUCT */}
      <Step number="01" title="Escolhe o produto" description="Opcional — reutiliza um produto da tua biblioteca para maior fidelidade.">
        {products.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface-1 p-6 text-sm text-muted-foreground">
            Ainda não tens produtos. Podes gerar sem produto, ou criar um na aba <span className="text-foreground">Produtos</span>.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Chip active={productId === null} onClick={() => setProductId(null)} label="Sem produto específico" />
            {products.map((p) => (
              <Chip
                key={String(p.id)}
                active={productId === p.id}
                onClick={() => setProductId(String(p.id))}
                label={String(p.name)}
              />
            ))}
          </div>
        )}
      </Step>

      {/* STEP 2 — STYLE */}
      <Step number="02" title="Estilo visual" description="A estética define a linguagem da campanha.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {IMAGE_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyle(s.id)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border p-4 text-left transition",
                style === s.id
                  ? "border-primary bg-primary/10 shadow-[0_20px_60px_-25px_oklch(0.82_0.13_82/0.5)]"
                  : "border-border bg-surface-1 hover:border-[color:var(--hairline)]",
              )}
            >
              {style === s.id && (
                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
              <p className="font-display text-base text-foreground">{s.label}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{s.hint}</p>
            </button>
          ))}
        </div>
      </Step>

      {/* STEP 3 — FORMAT */}
      <Step number="03" title="Formato" description="Adaptado a cada plataforma.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {IMAGE_FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              className={cn(
                "group flex items-center gap-3 rounded-2xl border p-4 text-left transition",
                format === f.id ? "border-primary bg-primary/10" : "border-border bg-surface-1 hover:border-[color:var(--hairline)]",
              )}
            >
              <FormatIcon aspect={f.aspect} active={format === f.id} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{f.label}</p>
                <p className="text-[11px] text-muted-foreground">{f.aspect}</p>
              </div>
            </button>
          ))}
        </div>
      </Step>

      {/* STEP 4 — NOTES */}
      <Step number="04" title="Direção adicional" description="Opcional — uma frase para orientar a IA.">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder='Ex.: "fundo preto com iluminação premium"'
          rows={3}
          className="w-full resize-none rounded-2xl border border-border bg-surface-1 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        />
      </Step>

      {/* GENERATE */}
      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-[color:var(--hairline)] bg-background/80 p-4 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Custo</p>
          <p className="font-display text-xl text-foreground">
            {cost} créditos <span className="text-xs font-normal text-muted-foreground">· 4 imagens</span>
          </p>
        </div>
        <button
          type="button"
          disabled={!canGenerate || insufficient}
          onClick={handleGenerate}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_20px_60px_-20px_oklch(0.82_0.13_82/0.6)] transition",
            (!canGenerate || insufficient) && "cursor-not-allowed opacity-50",
          )}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> A gerar…
            </>
          ) : insufficient ? (
            "Créditos insuficientes"
          ) : (
            <>
              <Wand2 className="h-4 w-4" /> Gerar imagens
            </>
          )}
        </button>
      </div>

      {error && <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}

      {/* RESULTS */}
      {(mutation.isPending || assets.length > 0) && (
        <section>
          <h3 className="mb-3 font-display text-xl text-foreground">Resultado</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {mutation.isPending && assets.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="aspect-square animate-pulse rounded-2xl border border-[color:var(--hairline)] bg-surface-2" />
                ))
              : assets.map((a) => (
                  <div key={a.id} className="group relative overflow-hidden rounded-2xl border border-[color:var(--hairline)] bg-black">
                    <img src={a.url} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[11px] text-white backdrop-blur hover:bg-white/20"
                      >
                        <Download className="h-3 w-3" /> Download
                      </a>
                      <button
                        type="button"
                        onClick={handleGenerate}
                        className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[11px] text-white backdrop-blur hover:bg-white/20"
                      >
                        <RefreshCcw className="h-3 w-3" /> Gerar
                      </button>
                    </div>
                  </div>
                ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Step({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs text-primary">{number}</p>
          <h2 className="font-display text-2xl text-foreground">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-xs font-medium transition",
        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface-1 text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function FormatIcon({ aspect, active }: { aspect: string; active: boolean }) {
  const dim =
    aspect === "9:16" ? { w: 14, h: 24 } : aspect === "16:9" ? { w: 24, h: 14 } : { w: 20, h: 20 };
  return (
    <div
      style={{ width: dim.w, height: dim.h }}
      className={cn("shrink-0 rounded", active ? "bg-primary" : "bg-muted-foreground/40")}
    />
  );
}
