import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ImageIcon, Film, Package, Gem, Sparkles, Zap, Palette } from "lucide-react";
import { useStudio } from "@/lib/studio-context";
import showcase1 from "@/assets/studio-showcase-1.jpg";
import showcase2 from "@/assets/studio-showcase-2.jpg";
import showcase3 from "@/assets/studio-showcase-3.jpg";
import showcase4 from "@/assets/studio-showcase-4.jpg";
import showcase5 from "@/assets/studio-showcase-5.jpg";
import showcase6 from "@/assets/studio-showcase-6.jpg";

export const Route = createFileRoute("/_app/ferramentas/studio/")({
  component: StudioHome,
});

const inspiration = [
  { src: showcase1, tag: "Beauty" },
  { src: showcase2, tag: "Tech" },
  { src: showcase3, tag: "Fitness" },
  { src: showcase4, tag: "Fragrance" },
  { src: showcase5, tag: "Audio" },
  { src: showcase6, tag: "Café" },
];

function StudioHome() {
  const { balance, brand, products } = useStudio();
  const hasBrand = Boolean(brand?.brand_name);

  return (
    <div className="space-y-12">
      {/* STATUS STRIP */}
      <section className="grid gap-3 md:grid-cols-3">
        <div className="relative overflow-hidden rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-6">
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{ background: "radial-gradient(ellipse 80% 60% at 0% 0%, oklch(0.82 0.13 82 / 0.18), transparent 60%)" }}
          />
          <div className="relative">
            <div className="flex items-center gap-2 text-primary">
              <Gem className="h-4 w-4" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em]">Saldo</p>
            </div>
            <p className="mt-2 font-display text-5xl text-foreground">{balance.toLocaleString("pt-PT")}</p>
            <p className="mt-1 text-xs text-muted-foreground">créditos disponíveis</p>
          </div>
        </div>

        <Link
          to="/ferramentas/studio/marca"
          className="group rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-6 transition hover:border-primary/50"
        >
          <div className="flex items-center gap-2 text-foreground">
            <Gem className="h-4 w-4 text-primary" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Brand DNA</p>
          </div>
          <p className="mt-2 font-display text-xl text-foreground">
            {hasBrand ? String(brand?.brand_name) : "Configurar marca"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasBrand ? "A IA usa o teu ADN em cada criativo." : "Uma configuração — para sempre."}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
            {hasBrand ? "Editar" : "Configurar"} <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
          </span>
        </Link>

        <Link
          to="/ferramentas/studio/produtos"
          className="group rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-6 transition hover:border-primary/50"
        >
          <div className="flex items-center gap-2 text-foreground">
            <Package className="h-4 w-4 text-primary" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Produtos</p>
          </div>
          <p className="mt-2 font-display text-xl text-foreground">
            {products.length > 0 ? `${products.length} na biblioteca` : "Primeiro produto"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {products.length > 0 ? "Reutiliza em cada geração." : "Guarda uma vez, gera para sempre."}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
            {products.length > 0 ? "Gerir" : "Adicionar"} <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
      </section>

      {/* HERO CTAs */}
      <section className="grid gap-4 md:grid-cols-2">
        <Link
          to="/ferramentas/studio/imagens"
          className="group relative aspect-[4/3] overflow-hidden rounded-3xl border border-[color:var(--hairline)] bg-black md:aspect-[5/3]"
        >
          <img src={showcase1} alt="Fotografia publicitária com IA" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/0" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <ImageIcon className="h-5 w-5" />
            </span>
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">40 créditos · 4 imagens</p>
            <h3 className="mt-1 font-display text-3xl text-white md:text-4xl">MM Vision</h3>
            <p className="mt-2 max-w-md text-sm text-white/80">
              Modelos reais a usar o teu produto. Beauty, tech, fitness, fashion — geração paralela em segundos.
            </p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
              Começar geração <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </div>
        </Link>

        <Link
          to="/ferramentas/studio/videos"
          className="group relative aspect-[4/3] overflow-hidden rounded-3xl border border-[color:var(--hairline)] bg-black md:aspect-[5/3]"
        >
          <img src={showcase4} alt="Vídeos publicitários com IA" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/0" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-lg">
              <Film className="h-5 w-5" />
            </span>
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-secondary">250 créditos · Veo 3</p>
            <h3 className="mt-1 font-display text-3xl text-white md:text-4xl">IA de Vídeos</h3>
            <p className="mt-2 max-w-md text-sm text-white/80">
              Anúncios cinematográficos verticais e horizontais. Storyboard automático, som ambiente, prontos para Reels e Ads.
            </p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-secondary">
              Explorar Veo <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </div>
        </Link>
      </section>

      {/* INSPIRATION MASONRY */}
      <section className="space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Inspiração</p>
          <h2 className="mt-2 font-display text-2xl text-foreground md:text-3xl">Feito com MM Studio.</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Cada imagem foi gerada com IA a partir de um produto real. Sem prompts, sem fotógrafo, sem set.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
          {inspiration.map((it, i) => (
            <figure
              key={i}
              className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-[color:var(--hairline)]"
            >
              <img src={it.src} alt={it.tag} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3">
                <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-primary">{it.tag}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* PROCESS */}
      <section className="rounded-3xl border border-dashed border-border bg-surface-1 p-8">
        <div className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Como funciona</p>
          <h2 className="mt-2 font-display text-2xl text-foreground">Três passos, criativos ilimitados.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Palette, n: "01", t: "Configura o Brand DNA", d: "Nome, cores, tom, público. Uma vez." },
            { icon: Package, n: "02", t: "Guarda os teus produtos", d: "Foto, categoria, descrição, cores." },
            { icon: Zap, n: "03", t: "Gera em paralelo", d: "4 variações a correr ao mesmo tempo." },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl border border-[color:var(--hairline)] bg-background/50 p-5">
              <s.icon className="h-5 w-5 text-primary" />
              <p className="mt-3 font-display text-3xl text-primary/70">{s.n}</p>
              <p className="mt-2 font-medium text-foreground">{s.t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
