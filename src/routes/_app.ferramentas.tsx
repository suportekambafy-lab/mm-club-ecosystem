import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowRight, ImageIcon, Film, Wand2, Package, Palette, FlaskConical, Youtube, Link2, LayoutGrid } from "lucide-react";
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

const mmTools = [
  {
    to: "/ferramentas/studio",
    icon: Wand2,
    kicker: "MM Studio",
    title: "Criativos com IA",
    desc: "Imagens e vídeos publicitários com modelos reais — qualidade de agência, sem prompts.",
    cta: "Abrir MM Studio",
    tag: "Premium",
    cover: showcase1,
  },
  {
    to: "/ferramentas/product-lab",
    icon: FlaskConical,
    kicker: "MM Product Lab",
    title: "Mineração de produtos",
    desc: "Encontra, organiza e valida produtos com Score MM e análise IA.",
    cta: "Começar a minerar",
    tag: "Grátis",
    cover: showcase4,
  },
  {
    to: "/ferramentas/thumbnails",
    icon: Youtube,
    kicker: "Thumbnail Builder",
    title: "Thumbnails que fazem clicar",
    desc: "Cola o link do YouTube e recebe duas thumbnails 16:9 prontas.",
    cta: "Criar thumbnail",
    tag: "Créditos",
    cover: showcase2,
  },
] as const;

const studioModules = [
  {
    to: "/ferramentas/studio/imagens",
    icon: ImageIcon,
    kicker: "MM Vision",
    title: "Fotografias publicitárias",
    desc: "4 variações por geração — modelos, lifestyle, still life, flat lay.",
  },
  {
    to: "/ferramentas/studio/videos",
    icon: Film,
    kicker: "MM Motion",
    title: "Vídeos cinematográficos",
    desc: "Anúncios verticais e horizontais prontos para Reels, TikTok e Meta Ads.",
  },
  {
    to: "/ferramentas/studio/logotipos",
    icon: Palette,
    kicker: "MM Identity",
    title: "Logotipos e identidade",
    desc: "Marcas completas a partir do teu Brand DNA.",
  },
  {
    to: "/ferramentas/studio/produtos",
    icon: Package,
    kicker: "Biblioteca",
    title: "Os teus produtos",
    desc: "Guarda fotos e fichas para reutilizar em cada geração.",
  },
] as const;

function FerramentasLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isChild = pathname.replace(/\/$/, "") !== "/ferramentas";

  if (isChild) return <Outlet />;

  return (
    <div className="space-y-12">
      {/* HEADER */}
      <section className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Central de Ferramentas</p>
        <h1 className="font-display text-4xl leading-[1] text-foreground md:text-5xl">Ferramentas do MM Club</h1>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          Aqui tens duas coisas: as <strong className="text-foreground">ferramentas do clube</strong> (criar
          criativos, minerar produtos, fazer thumbnails) e a{" "}
          <strong className="text-foreground">lista de links</strong> das plataformas que usamos nas aulas.
        </p>
      </section>

      {/* SECTION 1 — MM CLUB TOOLS */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-[color:var(--hairline)]">
            <LayoutGrid className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-2xl text-foreground">1 · Ferramentas do MM Club</h2>
            <p className="text-xs text-muted-foreground">Feitas por nós, dentro da plataforma.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {mmTools.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="group relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-6 transition hover:border-primary/50"
            >
              <img
                loading="lazy"
                decoding="async"
                src={t.cover}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover opacity-[0.18] transition duration-700 group-hover:opacity-30"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface-1 via-surface-1/85 to-surface-1/40" />
              <div className="relative flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-[color:var(--hairline)]">
                    <t.icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">
                    {t.tag}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    {t.kicker}
                  </p>
                  <h3 className="mt-1 font-display text-2xl leading-tight text-foreground">{t.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{t.desc}</p>
                </div>
              </div>
              <span className="relative mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                {t.cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* SECTION 2 — LINKS */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/15 text-secondary ring-1 ring-[color:var(--hairline)]">
            <Link2 className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-2xl text-foreground">2 · Links úteis</h2>
            <p className="text-xs text-muted-foreground">As plataformas externas que usamos nas aulas.</p>
          </div>
        </div>

        <Link
          to="/ferramentas/links"
          className="group relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-7 transition hover:border-secondary/50 md:flex-row md:items-center md:justify-between md:p-9"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-70 transition group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(ellipse 60% 80% at 0% 100%, oklch(0.55 0.22 285 / 0.16), transparent 60%)",
            }}
          />
          <div className="relative max-w-xl">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                A stack oficial do MM Club
              </p>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">
                Grátis
              </span>
            </div>
            <h3 className="mt-1 font-display text-3xl text-foreground">Todos os links num só lugar</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Shopify, Lovable, IA, criativos, tráfego, pagamentos e automação — com link direto, logotipo e
              ofertas de parceiro.
            </p>
          </div>
          <span className="relative inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition group-hover:opacity-90">
            Ver links <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </section>

      {/* SECTION 3 — INSIDE STUDIO */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-[color:var(--hairline)]">
            <Wand2 className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-2xl text-foreground">Atalhos dentro do MM Studio</h2>
            <p className="text-xs text-muted-foreground">Vai direto ao módulo que precisas.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {studioModules.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className="group rounded-2xl border border-[color:var(--hairline)] bg-surface-1 p-5 transition hover:border-primary/50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-[color:var(--hairline)]">
                <m.icon className="h-4 w-4" />
              </span>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {m.kicker}
              </p>
              <p className="mt-1 font-medium text-foreground">{m.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Abrir <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* SHOWCASE */}
      <section className="space-y-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Gerado por MM Studio</p>
          <h2 className="mt-2 font-display text-2xl text-foreground md:text-3xl">O que consegues criar hoje.</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Campanhas com pessoas reais a usar o teu produto. Escolhe o estilo, o formato, e recebe 4 variações
            prontas para publicar.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {showcase.map((s, i) => (
            <figure
              key={i}
              className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-[color:var(--hairline)] bg-surface-1"
            >
              <img
                loading="lazy"
                decoding="async"
                src={s.src}
                alt={s.label}
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

      {/* COMING SOON */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-xl text-foreground">Em breve</h2>
          <p className="text-xs text-muted-foreground">Roadmap de ferramentas</p>
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

