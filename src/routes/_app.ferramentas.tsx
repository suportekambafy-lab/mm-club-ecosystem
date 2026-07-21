import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Sparkles, ImageIcon, Film, Wand2, Package, Palette } from "lucide-react";
import showcase1 from "@/assets/studio-showcase-1.jpg";
import showcase2 from "@/assets/studio-showcase-2.jpg";
import showcase3 from "@/assets/studio-showcase-3.jpg";
import showcase4 from "@/assets/studio-showcase-4.jpg";
import showcase5 from "@/assets/studio-showcase-5.jpg";
import showcase6 from "@/assets/studio-showcase-6.jpg";

export const Route = createFileRoute("/_app/ferramentas")({
  head: () => ({
    meta: [
      { title: "Ferramentas — MM Club" },
      {
        name: "description",
        content:
          "MM Studio e biblioteca de ferramentas premium para empreendedores digitais: geração de imagens e vídeos com IA, prompts, templates e recursos.",
      },
    ],
  }),
  component: FerramentasLayout,
});

const showcase = [
  { src: showcase1, tag: "Beleza · Skincare", label: "Le Sérum" },
  { src: showcase4, tag: "Perfumaria · Luxo", label: "Eau de Parfum" },
  { src: showcase2, tag: "Tech · Executivo", label: "Wireless Case" },
  { src: showcase3, tag: "Fitness · Lifestyle", label: "Hydro Bottle" },
  { src: showcase5, tag: "Áudio · Urbano", label: "Studio Headphones" },
  { src: showcase6, tag: "Café · Editorial", label: "Specialty Coffee" },
];

function FerramentasLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isStudio = pathname.startsWith("/ferramentas/studio");

  if (isStudio) return <Outlet />;

  return (
    <div className="space-y-14">
      {/* CINEMATIC HERO */}
      <section className="relative overflow-hidden rounded-[2rem] border border-[color:var(--hairline)] bg-black">
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-black via-black/70 to-black/20" />
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/90 via-transparent to-black/40" />
        <img
          src={showcase1}
          alt="MM Studio — criativos publicitários com IA"
          className="absolute inset-0 h-full w-full object-cover object-right opacity-80"
          loading="eager"
        />
        <div className="relative z-20 flex flex-col gap-6 p-8 md:p-14 lg:p-16 min-h-[520px] md:min-h-[560px] justify-end md:justify-center max-w-[720px]">
          <span className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/90 backdrop-blur">
            MM Studio · Criativos de Alta Conversão
          </span>
          <h1 className="font-display text-5xl leading-[0.95] text-white md:text-7xl">
            O teu estúdio
            <span className="block text-primary">de campanhas.</span>
          </h1>
          <p className="max-w-xl text-base text-white/80 md:text-lg">
            Fotografias publicitárias e vídeos cinematográficos com IA — modelos reais, produtos reais, qualidade de agência. Sem prompts, sem editar.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              to="/ferramentas/studio"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_20px_60px_-20px_oklch(0.82_0.13_82/0.7)] transition hover:opacity-90"
            >
              Abrir MM Studio <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/ferramentas/studio/marca"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/10"
            >
              Configurar Brand DNA
            </Link>
          </div>
        </div>
      </section>

      {/* SHOWCASE GALLERY */}
      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Gerado por MM Studio</p>
            <h2 className="mt-2 font-display text-3xl text-foreground md:text-4xl">O que consegues criar hoje.</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              Campanhas com pessoas reais a usar o teu produto — beleza, tech, moda, fitness, café. Escolhe o estilo, o formato, e recebe 4 variações prontas para publicar.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {showcase.map((s, i) => (
            <figure
              key={i}
              className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-[color:var(--hairline)] bg-surface-1"
            >
              <img
                src={s.src}
                alt={s.label}
                loading="lazy"
                className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
              />
              <figcaption className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-primary">{s.tag}</p>
                  <p className="mt-0.5 text-sm font-medium text-white">{s.label}</p>
                </div>
                <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/90 backdrop-blur">
                  IA
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* CAPABILITY GRID */}
      <section className="grid gap-4 md:grid-cols-2">
        <Link
          to="/ferramentas/studio/imagens"
          className="group relative overflow-hidden rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-8 transition hover:border-primary/50"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-70 transition group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(ellipse 70% 60% at 100% 0%, oklch(0.82 0.13 82 / 0.22), transparent 60%)",
            }}
          />
          <div className="relative flex flex-col gap-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-[color:var(--hairline)]">
              <ImageIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">MM Vision · Imagens</p>
              <h3 className="mt-1 font-display text-2xl text-foreground">Fotografias publicitárias</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                4 variações do teu produto por geração — modelos, lifestyle, still life, flat lay. Qualidade de agência criativa.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              Gerar imagens <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </div>
        </Link>

        <Link
          to="/ferramentas/studio/videos"
          className="group relative overflow-hidden rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-8 transition hover:border-secondary/50"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(ellipse 70% 60% at 100% 0%, oklch(0.55 0.22 285 / 0.18), transparent 60%)",
            }}
          />
          <div className="relative flex flex-col gap-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/15 text-secondary ring-1 ring-[color:var(--hairline)]">
              <Film className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">IA de Vídeos · Google Veo 3</p>
              <h3 className="mt-1 font-display text-2xl text-foreground">Vídeos cinematográficos</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Anúncios verticais e horizontais com movimento de câmara e storyboard automáticos — prontos a publicar em Reels, TikTok e Meta Ads.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-secondary">
              Gerar vídeos <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </div>
        </Link>
      </section>

      {/* WORKFLOW */}
      <section className="rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-8 md:p-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Fluxo profissional</p>
            <h2 className="mt-2 font-display text-2xl text-foreground md:text-3xl">Do produto à campanha, em minutos.</h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Palette, n: "01", t: "Brand DNA", d: "Nome, cores, tom, público. Uma vez, para sempre." },
            { icon: Package, n: "02", t: "Biblioteca de produtos", d: "Foto, categoria, descrição. Reutiliza em cada geração." },
            { icon: Wand2, n: "03", t: "Geração paralela", d: "4 variações em paralelo. Download, upscale, publica." },
          ].map((s) => (
            <div key={s.n} className="relative overflow-hidden rounded-2xl border border-[color:var(--hairline)] bg-background/50 p-6">
              <s.icon className="h-5 w-5 text-primary" />
              <p className="mt-4 font-display text-3xl text-primary/70">{s.n}</p>
              <p className="mt-2 font-medium text-foreground">{s.t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMING SOON */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-xl text-foreground">Em breve</h2>
          <p className="text-xs text-muted-foreground">Roadmap MM Studio</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            "Biblioteca de prompts",
            "Templates de landing page",
            "Calculadora de pricing",
            "Scripts de vendas",
            "Fornecedores LATAM",
            "Swipes de copy premium",
          ].map((t) => (
            <div key={t} className="rounded-2xl border border-dashed border-border bg-surface-1 p-5">
              <p className="text-sm font-medium text-foreground">{t}</p>
              <p className="mt-1 text-xs text-muted-foreground">Disponível em breve</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
