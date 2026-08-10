import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Link2, ImagePlus, PencilLine, Check, Loader2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MediaField } from "@/components/mm/media-field";
import { ScoreRing } from "@/components/mm/product-lab/score-ring";
import { mineFromUrl, mineFromImage, quickMineFromUrl, saveMinedProduct } from "@/lib/product-lab-mine.functions";
import { PL_CRITERIA, PL_SOURCES, PL_STATUSES, scoreTone, type PlStatus } from "@/lib/product-lab-config";

import { cn } from "@/lib/utils";

type Draft = Record<string, string | null>;

interface MineResult {
  draft: Draft;
  analysis: string;
  recommendation: string | null;
  scores: Record<string, number>;
  score: number | null;
  model?: string;
}

const STEPS = [
  "A analisar o produto",
  "A identificar informações",
  "A analisar a oportunidade",
  "A preparar o relatório",
];

function num(v: string) {
  const cleaned = String(v).replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return null;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;
  if (lastComma > -1 && lastDot > -1) {
    normalized = lastComma > lastDot ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
  } else if (lastComma > -1) {
    normalized = cleaned.length - lastComma <= 3 ? cleaned.replace(",", ".") : cleaned.replace(/,/g, "");
  } else if (lastDot > -1 && cleaned.length - lastDot > 3) {
    normalized = cleaned.replace(/\./g, "");
  }
  const n = Number(normalized);
  return Number.isNaN(n) ? null : n;
}


function AnalysisBody({ content }: { content: string }) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
      {content.split("\n").map((line, i) =>
        line.startsWith("###") ? (
          <p key={i} className="pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            {line.replace(/^#+\s*/, "")}
          </p>
        ) : line.trim() === "" ? (
          <span key={i} className="block h-1" />
        ) : (
          <p key={i}>{line.replace(/^[-*]\s*/, "• ")}</p>
        ),
      )}
    </div>
  );
}

function Steps({ active }: { active: number }) {
  return (
    <ul className="space-y-2.5">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-3 text-sm">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border transition",
              i < active
                ? "border-primary bg-primary/15 text-primary"
                : i === active
                  ? "border-primary/50 text-primary"
                  : "border-[color:var(--hairline)] text-muted-foreground/50",
            )}
          >
            {i < active ? (
              <Check className="h-3.5 w-3.5" />
            ) : i === active ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
            )}
          </span>
          <span className={cn(i <= active ? "text-foreground" : "text-muted-foreground/60")}>{s}</span>
        </li>
      ))}
    </ul>
  );
}

const recTone = (rec: string | null) => {
  if (rec === "Vale a pena aprofundar") return { dot: "🟢", label: "VALE A PENA APROFUNDAR", cls: "text-primary" };
  if (rec === "Precisa de mais validação") return { dot: "🟡", label: "PRECISA DE MAIS VALIDAÇÃO", cls: "text-foreground" };
  if (rec === "Baixo potencial neste momento")
    return { dot: "🔴", label: "BAIXO POTENCIAL NESTE MOMENTO", cls: "text-muted-foreground" };
  return null;
};

export function MineDialog({
  open,
  onOpenChange,
  onManual,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onManual: () => void;
  onSaved: (id: string) => void;
}) {
  const qc = useQueryClient();
  const runUrl = useServerFn(mineFromUrl);
  const runImage = useServerFn(mineFromImage);
  const runQuick = useServerFn(quickMineFromUrl);
  const persist = useServerFn(saveMinedProduct);

  const [stage, setStage] = useState<"input" | "analysing" | "result">("input");
  const [mode, setMode] = useState<"url" | "image">("url");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [step, setStep] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<MineResult | null>(null);
  const [status, setStatus] = useState<PlStatus>("found");
  const [form, setForm] = useState({
    name: "",
    category: "",
    sell_price: "",
    market: "",
    source: "",
    image_url: "",
    product_url: "",
    supplier: "",
  });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open) return;
    if (timer.current) clearInterval(timer.current);
    setStage("input");
    setMode("url");
    setUrl("");
    setImage("");
    setStep(0);
    setNotice(null);
    setResult(null);
    setStatus("found");
  }, [open]);

  const startSteps = () => {
    setStep(0);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setStep((s) => (s < STEPS.length - 1 ? s + 1 : s)), 2600);
  };
  const stopSteps = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const applyResult = (r: MineResult, n: string | null) => {
    setResult(r);
    setNotice(n);
    setForm({
      name: r.draft.name ?? "",
      category: r.draft.category ?? "",
      sell_price: (r.draft.price ?? "").replace(/[^\d.,]/g, ""),
      market: r.draft.market ?? "",
      source: r.draft.source ?? "",
      image_url: r.draft.image_url ?? "",
      product_url: r.draft.product_url ?? "",
      supplier: r.draft.supplier ?? "",
    });
    setStage("result");
  };

  // Fluxo rápido: colar link → extrair dados da página → confirmar → guardar.
  const quick = useMutation({
    mutationFn: async () => await runQuick({ data: { url } }),
    onSuccess: (res) => {
      if (!res.ok || !res.draft) {
        toast.info(res.notice ?? "Não conseguimos ler esse link.");
        return;
      }
      applyResult(
        { draft: res.draft as Draft, analysis: "", recommendation: null, scores: {}, score: null },
        res.notice ?? null,
      );
    },
    onError: () => toast.error("Não conseguimos ler esse link. Podes adicionar manualmente."),
  });

  const analyse = useMutation({
    mutationFn: async () => {
      startSteps();
      setStage("analysing");
      if (mode === "image") return await runImage({ data: { image_url: image } });
      return await runUrl({ data: { url } });
    },
    onSuccess: (res) => {
      stopSteps();
      if (!res.ok || !res.result) {
        setStage("input");
        toast.info(res.notice ?? "Não conseguimos analisar esse link.");
        return;
      }
      setStatus("analysis");
      applyResult(res.result as MineResult, res.notice ?? null);
    },
    onError: (e) => {
      stopSteps();
      setStage("input");
      toast.error(
        (e as Error).message?.includes("IA")
          ? "A IA está indisponível neste momento. Podes adicionar manualmente."
          : "Não conseguimos analisar agora. Tenta outro link ou adiciona manualmente.",
      );
    },
  });


  const missing = (() => {
    const list: string[] = [];
    if (!form.category.trim()) list.push("Categoria / nicho");
    if (!num(form.sell_price)) list.push("Preço de venda");
    if (!form.supplier.trim()) list.push("Fornecedor");
    if (!form.market.trim()) list.push("Mercado");
    return list;
  })();

  const save = useMutation({
    mutationFn: async () => {
      const notesParts = [
        result?.draft.problem ? `Problema que resolve: ${result.draft.problem}` : null,
        result?.draft.benefits ? `Benefícios: ${result.draft.benefits}` : null,
        result?.draft.audience ? `Público provável: ${result.draft.audience}` : null,
        result?.draft.description ? `Descrição: ${result.draft.description}` : null,
        result?.draft.store ? `Loja/site: ${result.draft.store}` : null,
      ].filter(Boolean);
      const res = await persist({
        data: {
          name: form.name.trim() || "Produto sem nome",
          category: form.category.trim() || null,
          sell_price: num(form.sell_price),
          market: form.market.trim() || null,
          source: form.source.trim() || null,
          supplier: form.supplier.trim() || null,
          image_url: form.image_url || null,
          product_url: form.product_url || null,
          notes: notesParts.length ? notesParts.join("\n") : null,
          status,
          scores: result?.scores ?? {},
          analysis: result?.analysis ?? "",
          recommendation: result?.recommendation ?? null,
          model: result?.model,
        },
      });
      return res.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["product-lab"] });
      toast.success(`Produto guardado em ${PL_STATUSES.find((s) => s.id === status)?.label ?? "Encontrados"}`);
      onOpenChange(false);
      onSaved(id);
    },

    onError: (e) => toast.error((e as Error).message ?? "Não foi possível guardar."),
  });

  const rec = recTone(result?.recommendation ?? null);
  const tone = scoreTone(result?.score ?? null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-3xl border-[color:var(--hairline)] bg-surface-1">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Minerar Produto</DialogTitle>
          <DialogDescription>
            {stage === "result"
              ? "Confirma os dados e escolhe em que coluna do quadro queres guardar."
              : "Cola o link do produto. Adicionamos ao teu quadro em segundos — a análise com IA é opcional."}
          </DialogDescription>
        </DialogHeader>

        {stage === "input" && (
          <div className="animate-in fade-in space-y-5">
            {mode === "url" ? (
              <div className="rounded-3xl border border-primary/30 bg-primary/[0.04] p-4">
                <span className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                  <Link2 className="h-3 w-3" /> Link do produto ou anúncio
                </span>
                <Input
                  autoFocus
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && url.trim()) quick.mutate();
                  }}
                  placeholder="Cole aqui o link do produto ou anúncio"
                  className="h-14 rounded-2xl border-primary/25 bg-background text-base"
                />
                <Button
                  className="mt-3 h-12 w-full rounded-2xl text-base"
                  disabled={!url.trim() || quick.isPending || analyse.isPending}
                  onClick={() => quick.mutate()}
                >
                  {quick.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Adicionar produto
                </Button>
                <Button
                  variant="outline"
                  className="mt-2 h-11 w-full rounded-2xl"
                  disabled={!url.trim() || quick.isPending || analyse.isPending}
                  onClick={() => analyse.mutate()}
                >
                  <Sparkles className="h-4 w-4" /> Adicionar e analisar com IA
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Também podes adicionar através de uma imagem ou preencher manualmente.

                </p>
              </div>
            ) : (
              <div className="rounded-3xl border border-primary/30 bg-primary/[0.04] p-4">
                <MediaField
                  label="Screenshot ou imagem do produto"
                  bucket="studio-media"
                  keyPrefix="product-lab/mine"
                  value={image}
                  onChange={setImage}
                  allowLink={false}
                  helper="Screenshot de anúncio, loja, produto ou vídeo social."
                />
                <Button
                  className="mt-3 h-12 w-full rounded-2xl text-base"
                  disabled={!image || analyse.isPending}
                  onClick={() => analyse.mutate()}
                >
                  <Sparkles className="h-4 w-4" /> Analisar imagem com IA
                </Button>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setMode(mode === "url" ? "image" : "url")}
              >
                {mode === "url" ? (
                  <>
                    <ImagePlus className="h-4 w-4" /> Enviar imagem
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" /> Usar link
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                className="rounded-full"
                onClick={() => {
                  onOpenChange(false);
                  onManual();
                }}
              >
                <PencilLine className="h-4 w-4" /> Adicionar manualmente
              </Button>
            </div>
          </div>
        )}

        {stage === "analysing" && (
          <div className="animate-in fade-in space-y-5 py-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Sparkles className="h-5 w-5 animate-pulse" />
              </span>
              <div>
                <p className="font-display text-lg text-foreground">Estamos a analisar esta oportunidade…</p>
                <p className="text-xs text-muted-foreground">Leva alguns segundos. Podes acompanhar aqui.</p>
              </div>
            </div>
            <Steps active={step} />
          </div>
        )}

        {stage === "result" && result && (
          <div className="animate-in fade-in space-y-5">
            {notice && (
              <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-3 text-xs text-muted-foreground">
                {notice}
              </div>
            )}

            <div className="flex items-start gap-4 rounded-3xl border border-[color:var(--hairline)] bg-background/50 p-4">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-[color:var(--hairline)] bg-background">
                {form.image_url ? (
                  <img src={form.image_url} alt={form.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                    sem imagem
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Produto encontrado</p>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nome do produto"
                  className="mt-1 rounded-xl"
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Input
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    placeholder="Categoria"
                    className="rounded-xl"
                  />
                  <Input
                    value={form.sell_price}
                    inputMode="decimal"
                    onChange={(e) => setForm((f) => ({ ...f, sell_price: e.target.value }))}
                    placeholder="Preço (€)"
                    className="rounded-xl"
                  />
                  <Input
                    value={form.market}
                    onChange={(e) => setForm((f) => ({ ...f, market: e.target.value }))}
                    placeholder="Mercado"
                    className="rounded-xl"
                  />
                  <select
                    value={form.source}
                    onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                    className="rounded-xl border border-[color:var(--hairline)] bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Fonte</option>
                    {PL_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                {result.draft.store && (
                  <p className="mt-2 truncate text-xs text-muted-foreground">Loja: {result.draft.store}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-3xl border border-[color:var(--hairline)] bg-background/50 p-4">
              <ScoreRing score={result.score} size={64} />
              <div className="min-w-0">
                <p className="font-display text-lg text-foreground">
                  {result.score != null ? `Score MM ${result.score}/100` : "Sem score suficiente"}
                </p>
                <p className={cn("text-xs", tone.className)}>{tone.label}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Calculado apenas com os critérios MM:{" "}
                  {PL_CRITERIA.filter((c) => result.scores[c.id] != null)
                    .map((c) => `${c.label} ${result.scores[c.id]}/10`)
                    .join(" · ") || "sem notas atribuídas"}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-[color:var(--hairline)] bg-background/50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                Análise inicial da IA
              </p>
              {rec && (
                <p className={cn("mt-2 text-sm font-semibold", rec.cls)}>
                  {rec.dot} {rec.label}
                </p>
              )}
              <div className="mt-2">
                <AnalysisBody content={result.analysis} />
              </div>
              <p className="mt-4 border-t border-[color:var(--hairline)] pt-3 text-[11px] text-muted-foreground">
                Análise gerada por IA. Utilize como apoio à decisão e valide sempre no mercado.
              </p>
            </div>

            {missing.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Algumas informações ainda estão por preencher: {missing.join(", ")}. Podes guardar mesmo assim e
                completar depois.
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" className="rounded-full" onClick={() => setStage("input")}>
                <RefreshCw className="h-4 w-4" /> Analisar outro
              </Button>
              <Button className="rounded-full" disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {missing.length > 0 ? "Guardar mesmo assim" : "Guardar no Product Lab"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
