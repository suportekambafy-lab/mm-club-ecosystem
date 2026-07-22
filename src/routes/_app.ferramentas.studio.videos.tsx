import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Film, Loader2, Play, Download, ChevronDown } from "lucide-react";
import { useStudio } from "@/lib/studio-context";
import { startVideoGeneration, pollVideoGeneration, listAssets } from "@/lib/studio.functions";
import { VIDEO_STYLES, VIDEO_FORMATS, VIDEO_DURATIONS, VIDEO_OBJECTIVES, PEOPLE_OPTIONS, CONVERSION_HOOKS, videoCost, videoSegments, type PeoplePreset, type ConversionHook } from "@/lib/studio-config";
import { VideoPlaylist } from "@/components/mm/video-playlist";
import { MergedDownloadButton } from "@/components/mm/merged-download-button";


export const Route = createFileRoute("/_app/ferramentas/studio/videos")({
  component: VideosPage,
});

function VideosPage() {
  const { products, balance, refresh } = useStudio();
  const start = useServerFn(startVideoGeneration);
  const poll = useServerFn(pollVideoGeneration);

  const firstProductId = (products[0] as { id?: string } | undefined)?.id ?? null;
  const [productId, setProductId] = useState<string | null>(firstProductId);
  const [style, setStyle] = useState<string>(VIDEO_STYLES[0].id);
  const [format, setFormat] = useState<typeof VIDEO_FORMATS[number]["id"]>(VIDEO_FORMATS[0].id);
  const [duration, setDuration] = useState<number>(8);
  const [objective, setObjective] = useState<string>(VIDEO_OBJECTIVES[0].id);
  const [people, setPeople] = useState<PeoplePreset>("none");
  const [hook, setHook] = useState<ConversionHook>("none");
  const [notes, setNotes] = useState("");
  const [captions, setCaptions] = useState<"none" | "pt" | "en" | "es">("none");
  const [captionText, setCaptionText] = useState("");
  const [narration, setNarration] = useState<"none" | "male_pt" | "female_pt" | "male_en" | "female_en" | "neutral">("none");
  const [narrationScript, setNarrationScript] = useState("");
  const [music, setMusic] = useState<"none" | "cinematic" | "upbeat" | "elegant" | "epic" | "chill" | "corporate">("none");

  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState<string>("");
  const [videoUrls, setVideoUrls] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const segments = useMemo(() => videoSegments(duration), [duration]);
  const cost = useMemo(() => videoCost(duration), [duration]);
  const canPay = balance >= cost;

  const aspect = useMemo(() => VIDEO_FORMATS.find((f) => f.id === format)?.aspect ?? "9:16", [format]);

  async function loopPoll(assetId: string) {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    try {
      const r = await poll({ data: { assetId } });
      if (r.status === "ready") {
        const urls = (r as { urls?: string[] }).urls?.length ? (r as { urls: string[] }).urls : (r.url ? [r.url] : []);
        setVideoUrls(urls);
        setBusy(false);
        setStatusText("");
        refresh();
        return;
      }
      if (r.status === "failed") {
        setError(r.error ?? "Falhou");
        setBusy(false);
        setStatusText("");
        refresh();
        return;
      }
      setStatusText(segments.length > 1
        ? `A renderizar ${segments.length} segmentos em paralelo (${duration}s totais)…`
        : "A renderizar vídeo… pode demorar 1–3 minutos.");
      pollTimer.current = setTimeout(() => loopPoll(assetId), 8000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no polling");
      setBusy(false);
    }
  }

  async function onGenerate() {
    setError(null);
    setVideoUrls(null);
    setBusy(true);
    setStatusText("A iniciar geração…");
    try {
      const r = await start({
        data: {
          productId,
          style,
          format,
          duration,
          objective,
          people,
          hook,
          notes: notes || undefined,
          captions,
          captionText: captionText || undefined,
          narration,
          narrationScript: narrationScript || undefined,
          music,
        },
      });
      refresh();
      setStatusText("Vídeo em fila. A monitorizar…");
      loopPoll(r.assetId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao iniciar");
      setBusy(false);
      setStatusText("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-6 md:p-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <span className="inline-flex items-center rounded-full border border-[color:var(--hairline)] bg-background/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">
              MM Motion
            </span>
            <h1 className="font-display text-3xl text-foreground md:text-4xl">Vídeos</h1>
            <p className="text-sm text-muted-foreground">Vídeos cinematográficos com storyboard, câmara e iluminação automáticos.</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--hairline)] bg-background/40 px-4 py-3 text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Custo</div>
            <div className="font-display text-2xl text-foreground">{cost}<span className="text-sm text-muted-foreground"> créditos</span></div>
            <div className="text-[11px] text-muted-foreground">Saldo: {balance}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5 rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-6">
          <Field label="Produto">
            <select
              value={productId ?? ""}
              onChange={(e) => setProductId(e.target.value || null)}
              className="w-full rounded-xl border border-[color:var(--hairline)] bg-background/40 px-3 py-2 text-sm"
            >
              <option value="">— Sem produto —</option>
              {(products as Array<{ id: string; name: string }>).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {productId && (() => {
              const p = (products as Array<{ id: string; photos?: string[] }>).find((x) => x.id === productId);
              const photos = p?.photos ?? [];
              if (photos.length === 0) {
                return (
                  <p className="mt-2 text-[11px] text-amber-500">
                    Este produto não tem fotos. Adiciona fotos em Produtos para que o vídeo mostre o produto real.
                  </p>
                );
              }
              return (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Referências:</span>
                  <div className="flex gap-1.5">
                    {photos.slice(0, 3).map((url, i) => (
                      <img key={i} src={url} alt="" className="h-9 w-9 rounded-md object-cover border border-[color:var(--hairline)]" />
                    ))}
                  </div>
                </div>
              );
            })()}
          </Field>

          <Field label="Estilo">
            <div className="flex flex-wrap gap-2">
              {VIDEO_STYLES.map((s) => (
                <Chip key={s.id} active={style === s.id} onClick={() => setStyle(s.id)}>{s.label}</Chip>
              ))}
            </div>
          </Field>

          <Field label="Formato">
            <div className="flex flex-wrap gap-2">
              {VIDEO_FORMATS.map((f) => (
                <Chip key={f.id} active={format === f.id} onClick={() => setFormat(f.id)}>
                  {f.label} · {f.aspect}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Duração">
            <div className="flex flex-wrap gap-2">
              {VIDEO_DURATIONS.map((d) => {
                const segs = videoSegments(d);
                return (
                  <Chip key={d} active={duration === d} onClick={() => setDuration(d)}>
                    {d}s{segs.length > 1 ? ` · ${segs.length}×` : ""}
                  </Chip>
                );
              })}
            </div>
            {segments.length > 1 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Gerado em {segments.length} segmentos ({segments.join("+")}s) em paralelo, com continuidade de cena. Reproduz em playlist contínua.
              </p>
            )}
          </Field>

          <Section title="Objetivo & Pessoas" summary={`${VIDEO_OBJECTIVES.find(o=>o.id===objective)?.label ?? "—"} · ${PEOPLE_OPTIONS.find(p=>p.id===people)?.label ?? "—"} · ${CONVERSION_HOOKS.find(h=>h.id===hook)?.label ?? "—"}`}>
            <Field label="Objetivo">
              <div className="flex flex-wrap gap-2">
                {VIDEO_OBJECTIVES.map((o) => (
                  <Chip key={o.id} active={objective === o.id} onClick={() => setObjective(o.id)}>{o.label}</Chip>
                ))}
              </div>
            </Field>

            <Field label="Pessoas no vídeo">
              <div className="flex flex-wrap gap-2">
                {PEOPLE_OPTIONS.map((p) => (
                  <Chip key={p.id} active={people === p.id} onClick={() => setPeople(p.id)}>{p.label}</Chip>
                ))}
              </div>
            </Field>

            <Field label="Ângulo de conversão">
              <div className="flex flex-wrap gap-2">
                {CONVERSION_HOOKS.map((h) => (
                  <Chip key={h.id} active={hook === h.id} onClick={() => setHook(h.id)}>{h.label}</Chip>
                ))}
              </div>
            </Field>
          </Section>

          <Section
            title="Áudio & Legendas"
            summary={`${narration === "none" ? "Sem narração" : "Narração"} · ${captions === "none" ? "Sem legendas" : captions.toUpperCase()} · ${music === "none" ? "Sem música" : music}`}
          >
            <Field label="Narração">
              <div className="flex flex-wrap gap-2">
                {([
                  { id: "none", label: "Sem narração" },
                  { id: "female_pt", label: "Voz feminina · PT" },
                  { id: "male_pt", label: "Voz masculina · PT" },
                  { id: "female_en", label: "Voz feminina · EN" },
                  { id: "male_en", label: "Voz masculina · EN" },
                  { id: "neutral", label: "Neutra premium" },
                ] as const).map((n) => (
                  <Chip key={n.id} active={narration === n.id} onClick={() => setNarration(n.id)}>{n.label}</Chip>
                ))}
              </div>
              {narration !== "none" && (
                <textarea
                  value={narrationScript}
                  onChange={(e) => setNarrationScript(e.target.value)}
                  rows={2}
                  placeholder="Guião da narração (opcional). Ex.: 'Redefinimos o luxo. Descobre a nova coleção.'"
                  className="mt-2 w-full rounded-xl border border-[color:var(--hairline)] bg-background/40 px-3 py-2 text-sm"
                />
              )}
            </Field>

            <Field label="Legendas">
              <div className="flex flex-wrap gap-2">
                {([
                  { id: "none", label: "Sem legendas" },
                  { id: "pt", label: "Português" },
                  { id: "en", label: "English" },
                  { id: "es", label: "Español" },
                ] as const).map((c) => (
                  <Chip key={c.id} active={captions === c.id} onClick={() => setCaptions(c.id)}>{c.label}</Chip>
                ))}
              </div>
              {captions !== "none" && (
                <input
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  placeholder="Texto exato da legenda (opcional)"
                  className="mt-2 w-full rounded-xl border border-[color:var(--hairline)] bg-background/40 px-3 py-2 text-sm"
                />
              )}
            </Field>

            <Field label="Música">
              <div className="flex flex-wrap gap-2">
                {([
                  { id: "none", label: "Sem música" },
                  { id: "cinematic", label: "Cinematográfica" },
                  { id: "upbeat", label: "Energética" },
                  { id: "elegant", label: "Elegante" },
                  { id: "epic", label: "Épica" },
                  { id: "chill", label: "Chill" },
                  { id: "corporate", label: "Corporate" },
                ] as const).map((m) => (
                  <Chip key={m.id} active={music === m.id} onClick={() => setMusic(m.id)}>{m.label}</Chip>
                ))}
              </div>
            </Field>
          </Section>

          <Section title="Instruções extra" summary={notes ? `${notes.slice(0, 40)}${notes.length > 40 ? "…" : ""}` : "Opcional"}>
            <Field label="Notas para o realizador">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Ex.: câmara a orbitar, luz dourada ao pôr-do-sol, movimento lento…"
                className="w-full rounded-xl border border-[color:var(--hairline)] bg-background/40 px-3 py-2 text-sm"
              />
            </Field>
          </Section>


          <button
            onClick={onGenerate}
            disabled={busy || !canPay}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-6 py-3 text-sm font-semibold text-background disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {busy ? "A gerar…" : canPay ? `Gerar vídeo (−${cost} cr)` : "Créditos insuficientes"}
          </button>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {statusText && !error && <p className="text-xs text-muted-foreground">{statusText}</p>}
        </div>

        <div className="rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-4">
          <div
            className="relative overflow-hidden rounded-2xl bg-background/60"
            style={{ aspectRatio: aspect.replace(":", " / ") }}
          >
            {videoUrls && videoUrls.length > 0 ? (
              <VideoPlaylist urls={videoUrls} className="h-full w-full" />
            ) : busy ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4">
                <Loader2 className="h-6 w-6 animate-spin text-secondary" />
                <p className="text-xs text-muted-foreground max-w-[240px]">{statusText || "A preparar…"}</p>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Film className="h-8 w-8" />
                <p className="text-xs">Pré-visualização do vídeo</p>
              </div>
            )}
          </div>
          {videoUrls && videoUrls.length > 0 && (
            <div className="mt-3">
              {videoUrls.length > 1 ? (
                <MergedDownloadButton urls={videoUrls} filename={`mm-studio-${Date.now()}.mp4`} />
              ) : (
                <a
                  href={videoUrls[0]}
                  download
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-background"
                >
                  <Download className="h-3.5 w-3.5" /> Descarregar MP4
                </a>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Section({ title, summary, children, defaultOpen = false }: { title: string; summary?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-[color:var(--hairline)] bg-background/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{title}</div>
          {summary && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{summary}</div>}
        </div>
        <ChevronDown className={"h-4 w-4 shrink-0 text-muted-foreground transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open && <div className="space-y-5 border-t border-[color:var(--hairline)] px-4 py-4">{children}</div>}
    </div>
  );
}



function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1.5 text-xs transition " +
        (active
          ? "border-secondary bg-secondary/15 text-foreground"
          : "border-[color:var(--hairline)] bg-background/40 text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
