import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, ImageIcon, Loader2, Sparkles, Youtube } from "lucide-react";
import { toast } from "sonner";
import { generateThumbnails } from "@/lib/studio.functions";
import { getStudioContext } from "@/lib/studio.functions";
import {
  THUMB_BATCH_COST,
  THUMB_STYLES,
  parseYouTubeId,
  type ThumbStyle,
} from "@/lib/thumbnail-config";
import { CreditsPill } from "@/components/mm/studio/studio-shell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/ferramentas/thumbnails")({
  head: () => ({
    meta: [
      { title: "Thumbnail Builder — MM Club" },
      {
        name: "description",
        content:
          "Cola o link do teu vídeo do YouTube e gera thumbnails de alto CTR com IA — texto curto opcional, o resto é automático.",
      },
      { property: "og:title", content: "Thumbnail Builder — MM Club" },
      {
        property: "og:description",
        content: "Thumbnails de YouTube com IA a partir do link do vídeo, dentro do MM Club.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThumbnailBuilder,
});

function ThumbnailBuilder() {
  const [url, setUrl] = useState("");
  const [headline, setHeadline] = useState("");
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState<ThumbStyle>("mrbeast");
  const [notes, setNotes] = useState("");
  const [results, setResults] = useState<{ id: string; url: string }[]>([]);
  const [usedHeadline, setUsedHeadline] = useState<string | null>(null);

  const loadContext = useServerFn(getStudioContext);
  const ctx = useQuery({ queryKey: ["studio-context"], queryFn: () => loadContext() });
  const balance = ctx.data?.credits?.balance ?? null;

  const generate = useServerFn(generateThumbnails);
  const mutation = useMutation({
    mutationFn: () =>
      generate({
        data: {
          youtubeUrl: url.trim() || undefined,
          headline: headline.trim() || undefined,
          topic: topic.trim() || undefined,
          style,
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: (res) => {
      setResults(res.assets);
      setUsedHeadline(res.headline);
      void ctx.refetch();
      toast.success("Thumbnails prontas.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao gerar."),
  });

  const urlOk = !url.trim() || Boolean(parseYouTubeId(url));
  const canGenerate = urlOk && (Boolean(url.trim()) || Boolean(topic.trim()) || Boolean(headline.trim()));

  return (
    <div className="space-y-8">
      <Link
        to="/ferramentas"
        className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Ferramentas
      </Link>

      <header className="relative overflow-hidden rounded-3xl border border-[color:var(--hairline)] bg-surface-1/60 p-6 backdrop-blur-xl md:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 15% 0%, oklch(0.82 0.13 82 / 0.15), transparent 60%)",
          }}
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--hairline)] bg-background/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              Thumbnail Builder
            </span>
            <h1 className="font-display text-3xl leading-tight text-foreground md:text-4xl">
              Thumbnails que fazem clicar.
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground md:text-base">
              Cola o link do vídeo. Se não escreveres texto, a IA escolhe a frase de maior impacto.
            </p>
          </div>
          <CreditsPill balance={balance} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <section className="space-y-5 rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-6">
          <Field label="Link do vídeo (YouTube)" hint="Opcional se descreveres o tema">
            <div className="relative">
              <Youtube className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtu.be/..."
                className={cn(
                  "w-full rounded-xl border bg-background/60 py-2.5 pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-primary/60",
                  urlOk ? "border-border" : "border-destructive",
                )}
              />
            </div>
            {!urlOk && <p className="mt-1 text-[11px] text-destructive">Link inválido.</p>}
          </Field>

          <Field label="Texto da thumbnail" hint="Máx. 5 palavras — deixa vazio e a IA escreve">
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={60}
              placeholder="Ex.: PERDI 10.000€"
              className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/60"
            />
          </Field>

          <Field label="Tema do vídeo" hint="Opcional — usado se não houver link">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={300}
              placeholder="Ex.: como escalar uma loja em 30 dias"
              className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/60"
            />
          </Field>

          <Field label="Estilo">
            <div className="grid grid-cols-2 gap-2">
              {THUMB_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyle(s.id)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition",
                    style === s.id
                      ? "border-primary/60 bg-primary/10"
                      : "border-border bg-background/40 hover:border-[color:var(--hairline)]",
                  )}
                >
                  <span className="block text-xs font-semibold text-foreground">{s.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{s.hint}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Notas extra" hint="Opcional">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={400}
              rows={3}
              placeholder="Ex.: incluir um portátil e tons de azul"
              className="w-full resize-none rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/60"
            />
          </Field>

          <button
            type="button"
            disabled={!canGenerate || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> A gerar…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Gerar thumbnails · {THUMB_BATCH_COST} créditos
              </>
            )}
          </button>
        </section>

        <section className="space-y-4">
          {usedHeadline && (
            <p className="text-xs text-muted-foreground">
              Texto usado: <span className="font-semibold text-foreground">{usedHeadline}</span>
            </p>
          )}
          {results.length === 0 && !mutation.isPending ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-surface-1 p-10 text-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                As tuas thumbnails 16:9 aparecem aqui — duas variações por geração.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {mutation.isPending
                ? Array.from({ length: 2 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-video animate-pulse rounded-2xl border border-[color:var(--hairline)] bg-surface-2"
                    />
                  ))
                : results.map((r) => (
                    <figure
                      key={r.id}
                      className="group relative overflow-hidden rounded-2xl border border-[color:var(--hairline)] bg-black"
                    >
                      <img src={r.url} alt="Thumbnail gerada" loading="lazy" className="aspect-video w-full object-cover" />
                      <a
                        href={r.url}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-[11px] font-semibold text-foreground opacity-0 backdrop-blur transition group-hover:opacity-100"
                      >
                        <Download className="h-3.5 w-3.5" /> Descarregar
                      </a>
                    </figure>
                  ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </label>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
