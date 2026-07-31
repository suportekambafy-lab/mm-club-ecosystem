import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Sparkles, Download, Check, BadgeCheck, Layers, History } from "lucide-react";
import { generateLogos, setBrandLogo, generateLogoApplications, listLogoHistory } from "@/lib/studio.functions";

import {
  LOGO_STYLES,
  LOGO_LAYOUTS,
  LOGO_BACKGROUNDS,
  LOGO_PALETTES,
  LOGO_BATCH_COST,
  LOGO_VARIANTS,
  LOGO_APPLICATIONS,
  LOGO_APPLICATION_COST,
  type LogoStyle,
  type LogoLayout,
  type LogoBackground,
  type LogoPalette,
  type LogoApplicationId,
} from "@/lib/studio-logo";
import { useStudio } from "@/lib/studio-context";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_app/ferramentas/studio/logotipos")({
  head: () => ({
    meta: [
      { title: "Gerador de logotipos — MM Studio" },
      { name: "description", content: "Cria o logotipo da tua marca com IA: monograma, wordmark ou emblema, alinhado com o teu Brand DNA." },
      { property: "og:title", content: "Gerador de logotipos — MM Studio" },
      { property: "og:description", content: "Três variações profissionais de logotipo em segundos, no design da tua marca." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LogotiposPage,
});

type Asset = { id: string; url: string };

function LogotiposPage() {
  const { brand, balance, refresh } = useStudio();
  const brandName = (brand?.brand_name as string | undefined) ?? "";
  const brandSegment = (brand?.segment as string | undefined) ?? "";

  const [name, setName] = useState(brandName);
  const [tagline, setTagline] = useState("");
  const [industry, setIndustry] = useState(brandSegment);
  const [style, setStyle] = useState<LogoStyle | null>(null);
  const [layout, setLayout] = useState<LogoLayout>("horizontal");
  const [background, setBackground] = useState<LogoBackground>("branco");
  const [palette, setPalette] = useState<LogoPalette>("marca");
  const [notes, setNotes] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [baseLogo, setBaseLogo] = useState<string | null>(null);
  const [apps, setApps] = useState<LogoApplicationId[]>(["cartao", "sinalizacao", "embalagem"]);
  const [appAssets, setAppAssets] = useState<{ id: string; url: string; label: string }[]>([]);

  const fn = useServerFn(generateLogos);
  const saveFn = useServerFn(setBrandLogo);
  const appsFn = useServerFn(generateLogoApplications);

  const mutation = useMutation({
    mutationFn: () =>
      fn({
        data: {
          brandName: name.trim(),
          tagline: tagline.trim() || undefined,
          industry: industry.trim() || undefined,
          style: style as LogoStyle,
          layout,
          background,
          palette,
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: (data) => {
      setAssets(data.assets);
      setBaseLogo(data.assets[0]?.url ?? null);
      setError(null);
      refresh();
    },
    onError: (e) => setError((e as Error).message),
  });

  const saveMutation = useMutation({
    mutationFn: (url: string) => saveFn({ data: { url } }),
    onSuccess: (_r, url) => {
      setSavedUrl(url);
      refresh();
    },
    onError: (e) => setError((e as Error).message),
  });

  const appsMutation = useMutation({
    mutationFn: () =>
      appsFn({
        data: {
          logoUrl: baseLogo as string,
          applications: apps,
          brandName: name.trim(),
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: (data) => {
      setAppAssets(data.assets.map((a) => ({ id: a.id, url: a.url, label: a.label })));
      setError(null);
      refresh();
    },
    onError: (e) => setError((e as Error).message),
  });

  const appsCost = apps.length * LOGO_APPLICATION_COST;
  const toggleApp = (id: LogoApplicationId) =>
    setApps((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : prev.length >= 6 ? prev : [...prev, id]));


  const insufficient = balance < LOGO_BATCH_COST;
  const canGenerate = Boolean(style) && name.trim().length > 0 && !mutation.isPending;

  const handleGenerate = () => {
    if (!canGenerate) return;
    setAssets([]);
    setError(null);
    setSavedUrl(null);
    setBaseLogo(null);
    setAppAssets([]);
    mutation.mutate();
  };


  return (
    <div className="space-y-8">
      <header>
        <p className="font-display text-xs text-primary">MM Identity</p>
        <h1 className="font-display text-3xl text-foreground md:text-4xl">Gerador de logotipos.</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Diz-nos o nome e a direção estética — geramos {LOGO_VARIANTS} variações profissionais, prontas a usar.
        </p>
      </header>

      {/* 01 — MARCA */}
      <Step number="01" title="A tua marca" description="O nome tem de estar escrito exatamente como o queres ver.">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Nome da marca">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Ex.: MM Club"
              className="w-full rounded-2xl border border-border bg-surface-1 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </Field>
          <Field label="Tagline (opcional)">
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={80}
              placeholder="Ex.: Marca Milionária"
              className="w-full rounded-2xl border border-border bg-surface-1 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </Field>
          <Field label="Setor (opcional)">
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              maxLength={120}
              placeholder="Ex.: moda premium"
              className="w-full rounded-2xl border border-border bg-surface-1 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </Field>
        </div>
      </Step>

      {/* 02 — ESTILO */}
      <Step number="02" title="Estilo do logotipo" description="A construção define a personalidade da identidade.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {LOGO_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyle(s.id)}
              className={cn(
                "relative overflow-hidden rounded-2xl border p-4 text-left transition",
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

      {/* 03 — COMPOSIÇÃO */}
      <Step number="03" title="Composição, cor e fundo" description="Como o símbolo e o nome se organizam.">
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Composição</p>
            <div className="flex flex-wrap gap-2">
              {LOGO_LAYOUTS.map((l) => (
                <Chip key={l.id} active={layout === l.id} onClick={() => setLayout(l.id)} label={l.label} />
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{LOGO_LAYOUTS.find((l) => l.id === layout)?.hint}</p>
          </div>
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Paleta</p>
            <div className="flex flex-wrap gap-2">
              {LOGO_PALETTES.map((p) => (
                <Chip key={p.id} active={palette === p.id} onClick={() => setPalette(p.id)} label={p.label} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Fundo</p>
            <div className="flex flex-wrap gap-2">
              {LOGO_BACKGROUNDS.map((b) => (
                <Chip key={b.id} active={background === b.id} onClick={() => setBackground(b.id)} label={b.label} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Direção adicional (opcional)</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={600}
              placeholder='Ex.: "incluir um cubo abstrato inspirado em arquitetura"'
              className="w-full resize-none rounded-2xl border border-border bg-surface-1 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </Step>

      {/* GERAR */}
      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-[color:var(--hairline)] bg-background/80 p-4 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Custo</p>
          <p className="font-display text-xl text-foreground">
            {LOGO_BATCH_COST} créditos{" "}
            <span className="text-xs font-normal text-muted-foreground">· {LOGO_VARIANTS} variações</span>
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
              <Loader2 className="h-4 w-4 animate-spin" /> A desenhar…
            </>
          ) : insufficient ? (
            "Créditos insuficientes"
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Gerar logotipos
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>
      )}

      {(mutation.isPending || assets.length > 0) && (
        <section>
          <h2 className="mb-3 font-display text-xl text-foreground">Variações</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {mutation.isPending && assets.length === 0
              ? Array.from({ length: LOGO_VARIANTS }).map((_, i) => (
                  <div key={i} className="aspect-square animate-pulse rounded-2xl border border-[color:var(--hairline)] bg-surface-2" />
                ))
              : assets.map((a) => (
                  <div
                    key={a.id}
                    className={cn(
                      "overflow-hidden rounded-2xl border bg-surface-1 transition",
                      baseLogo === a.url ? "border-primary shadow-[0_20px_60px_-25px_oklch(0.82_0.13_82/0.5)]" : "border-[color:var(--hairline)]",
                    )}
                  >
                    <button type="button" onClick={() => setBaseLogo(a.url)} className="block w-full">
                      <img src={a.url} alt={`Logotipo ${name}`} loading="lazy" decoding="async" className="aspect-square w-full object-contain" />
                    </button>
                    <div className="flex items-center justify-between gap-2 border-t border-[color:var(--hairline)] p-3">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[11px] text-foreground transition hover:border-primary/50"
                      >
                        <Download className="h-3 w-3" /> Download
                      </a>
                      <button
                        type="button"
                        onClick={() => saveMutation.mutate(a.url)}
                        disabled={saveMutation.isPending}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium transition",
                          savedUrl === a.url
                            ? "bg-primary/15 text-primary"
                            : "bg-primary text-primary-foreground hover:brightness-110",
                        )}
                      >
                        <BadgeCheck className="h-3 w-3" />
                        {savedUrl === a.url ? "Logo da marca" : "Usar na marca"}
                      </button>
                    </div>
                  </div>
                ))}
          </div>
          {assets.length > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Clica numa variação para a usar como base dos mockups e banners.
            </p>
          )}
        </section>
      )}

      {/* 04 — APLICAÇÕES / MOCKUPS */}
      {baseLogo && (
        <Step number="04" title="Mockups e banners" description="Aplica o logotipo escolhido em cartões, fachadas, embalagem, app, banners…">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <img
              src={baseLogo}
              alt={`Logotipo base ${name}`}
              className="h-24 w-24 shrink-0 rounded-2xl border border-[color:var(--hairline)] bg-surface-1 object-contain p-2"
            />
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {LOGO_APPLICATIONS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleApp(a.id)}
                    className={cn(
                      "rounded-2xl border p-3 text-left transition",
                      apps.includes(a.id)
                        ? "border-primary bg-primary/10"
                        : "border-border bg-surface-1 hover:border-[color:var(--hairline)]",
                    )}
                  >
                    <p className="font-display text-sm text-foreground">{a.label}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{a.hint}</p>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--hairline)] bg-surface-1 p-4">
                <p className="font-display text-base text-foreground">
                  {appsCost} créditos{" "}
                  <span className="text-xs font-normal text-muted-foreground">· {apps.length} aplicações</span>
                </p>
                <button
                  type="button"
                  disabled={apps.length === 0 || appsMutation.isPending || balance < appsCost}
                  onClick={() => {
                    setAppAssets([]);
                    setError(null);
                    appsMutation.mutate();
                  }}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition",
                    (apps.length === 0 || appsMutation.isPending || balance < appsCost) && "cursor-not-allowed opacity-50",
                  )}
                >
                  {appsMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> A montar…
                    </>
                  ) : balance < appsCost ? (
                    "Créditos insuficientes"
                  ) : (
                    <>
                      <Layers className="h-4 w-4" /> Gerar aplicações
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {(appsMutation.isPending || appAssets.length > 0) && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {appsMutation.isPending && appAssets.length === 0
                ? apps.map((id) => (
                    <div key={id} className="aspect-[3/2] animate-pulse rounded-2xl border border-[color:var(--hairline)] bg-surface-2" />
                  ))
                : appAssets.map((a) => (
                    <figure key={a.id} className="overflow-hidden rounded-2xl border border-[color:var(--hairline)] bg-surface-1">
                      <img src={a.url} alt={`${a.label} — ${name}`} loading="lazy" decoding="async" className="w-full object-cover" />
                      <figcaption className="flex items-center justify-between gap-2 border-t border-[color:var(--hairline)] p-3">
                        <span className="text-xs text-muted-foreground">{a.label}</span>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[11px] text-foreground transition hover:border-primary/50"
                        >
                          <Download className="h-3 w-3" /> Download
                        </a>
                      </figcaption>
                    </figure>
                  ))}
            </div>
          )}
        </Step>
      )}

    </div>
  );
}

function Step({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4">
        <p className="font-display text-xs text-primary">{number}</p>
        <h2 className="font-display text-2xl text-foreground">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
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
