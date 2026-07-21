import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ImageIcon, Film, Package, Gem, Sparkles } from "lucide-react";
import { useStudio } from "@/lib/studio-context";

export const Route = createFileRoute("/_app/ferramentas/studio/")({
  component: StudioHome,
});

function StudioHome() {
  const { balance, brand, products } = useStudio();
  const hasBrand = Boolean(brand?.brand_name);

  return (
    <div className="space-y-10">
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          to="/ferramentas/studio/imagens"
          className="group relative overflow-hidden rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-8 transition hover:border-primary/50"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-70 transition group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(ellipse 60% 60% at 100% 0%, oklch(0.82 0.13 82 / 0.18), transparent 60%)",
            }}
          />
          <div className="relative flex flex-col gap-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-[color:var(--hairline)]">
              <ImageIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">40 créditos / imagem</p>
              <h3 className="mt-1 font-display text-2xl text-foreground">IA de Imagens</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Fotografias publicitárias realistas do teu produto em 4 variações. Escolhe o estilo e o formato — sem prompts.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              Começar <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
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
                "radial-gradient(ellipse 60% 60% at 100% 0%, oklch(0.55 0.22 285 / 0.15), transparent 60%)",
            }}
          />
          <div className="relative flex flex-col gap-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/15 text-secondary ring-1 ring-[color:var(--hairline)]">
              <Film className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">250 créditos / vídeo</p>
              <h3 className="mt-1 font-display text-2xl text-foreground">IA de Vídeos</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Vídeos publicitários cinematográficos a partir das tuas imagens. Storyboard e movimentos de câmara automáticos.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-secondary">
              Explorar <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </div>
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-6">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">Saldo</p>
          </div>
          <p className="mt-2 font-display text-4xl text-foreground">{balance.toLocaleString("pt-PT")}</p>
          <p className="mt-1 text-xs text-muted-foreground">créditos disponíveis</p>
        </div>

        <Link to="/ferramentas/studio/marca" className="group rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-6 transition hover:border-primary/50">
          <div className="flex items-center gap-2 text-foreground">
            <Gem className="h-4 w-4" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">Brand DNA</p>
          </div>
          <p className="mt-2 font-display text-lg text-foreground">
            {hasBrand ? String(brand?.brand_name) : "Configurar a tua marca"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasBrand ? "A IA usa o teu ADN em cada criativo." : "Uma configuração — para sempre."}
          </p>
        </Link>

        <Link to="/ferramentas/studio/produtos" className="group rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-6 transition hover:border-primary/50">
          <div className="flex items-center gap-2 text-foreground">
            <Package className="h-4 w-4" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">Produtos</p>
          </div>
          <p className="mt-2 font-display text-lg text-foreground">
            {products.length > 0 ? `${products.length} na biblioteca` : "Criar o primeiro produto"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {products.length > 0 ? "Reutiliza em cada geração." : "Guarda uma vez, gera para sempre."}
          </p>
        </Link>
      </section>

      <section className="rounded-3xl border border-dashed border-border bg-surface-1 p-8">
        <h2 className="font-display text-2xl text-foreground">Como funciona</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { n: "01", t: "Configura o Brand DNA", d: "Nome, cores, tom, público. Uma vez." },
            { n: "02", t: "Guarda os teus produtos", d: "Nome, fotos, categoria, cores." },
            { n: "03", t: "Gera criativos", d: "Escolhe estilo e formato. Nós tratamos do prompt." },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl border border-[color:var(--hairline)] bg-background/50 p-5">
              <p className="font-display text-3xl text-primary">{s.n}</p>
              <p className="mt-2 font-medium text-foreground">{s.t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
