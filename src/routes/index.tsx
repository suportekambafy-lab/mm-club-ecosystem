import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Play,
  Sparkles,
  Circle,
  Radio,
  Calendar,
  MessageCircle,
  Heart,
  Send,
} from "lucide-react";
import { MMLogo } from "@/components/mm/logo";
import { BigTypeHero } from "@/components/mm/big-type-hero";
import cover from "@/assets/marca-milionaria-cover.png.asset.json";
import legacyCover from "@/assets/marca-milionaria-legacy-hero.jpg.asset.json";
import homeAula from "@/assets/home-mentor-aula.jpg";
import homeLive from "@/assets/home-live.jpg";
import { useLegacyLaunch } from "@/hooks/use-legacy-launch";
import avatar1 from "@/assets/avatar-1.jpg";
import avatar2 from "@/assets/avatar-2.jpg";
import avatar3 from "@/assets/avatar-3.jpg";
import avatar4 from "@/assets/avatar-4.jpg";
import avatar5 from "@/assets/avatar-5.jpg";
import avatar6 from "@/assets/avatar-6.jpg";
const avatars = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6];

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "MM Club — Ecossistema privado da Marca Milionária" },
      { property: "og:title", content: "MM Club — Ecossistema privado da Marca Milionária" },
      { property: "og:description", content: "Academia, MM Inteligence, comunidade, lives e ferramentas para empreendedores portugueses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "description",
        content:
          "O clube privado da Marca Milionária. Academia, MM Inteligence, comunidade, lives e ferramentas para empreendedores portugueses. Premium por design.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // PWA / standalone mode: skip landing entirely — go straight to the app.
    // The /_app guard sends unauthenticated users to /auth automatically.
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      window.location.replace("/dashboard");
      return;
    }
    // Sessão existente NÃO força saída da landing page (permite ver o site
    // e trocar de conta em /auth). O acesso à app continua em /dashboard.

  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Nav scrolled={scrolled} />
      <BigTypeHero />
      <FeatureAcademia />
      <FeatureJade />
      <FeatureComunidade />
      <FeatureLives />
      <FeatureFerramentas />
      <FeatureEventos />
      <Manifesto />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ---------- NAV ---------- */

function Nav({ scrolled }: { scrolled: boolean }) {
  return (
    <div
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "backdrop-blur-xl bg-background/70 border-b border-border" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <MMLogo />
        <nav className="hidden items-center gap-8 md:flex">
          {[
            ["Academia", "academia"],
            ["MM Inteligence", "jade"],
            ["Comunidade", "comunidade"],
            ["Lives", "lives"],
          ].map(([label, id]) => (
            <a
              key={id}
              href={`#${id}`}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="inline-flex items-center rounded-full border border-border px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 sm:border-0 sm:text-muted-foreground sm:hover:text-foreground"
          >
            Entrar
          </Link>

          <Link
            to="/aplicacao"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-gold-soft transition-colors"
          >
            Aplicar <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------- HERO ---------- */

function HeroSlides() {
  const legacy = useLegacyLaunch();
  const heroSlides = [
    {
      image: legacyCover.url,
      eyebrow: legacy.eyebrow,
      title: legacy.headline,
      badge: legacy.badge,
    },
    {
      image: cover.url,
      eyebrow: "Apresentação MM Club",
      title: "2 min · assiste antes de aderir",
      badge: "HD",
    },
  ];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % heroSlides.length),
      6000,
    );
    return () => window.clearInterval(id);
  }, [heroSlides.length]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {heroSlides.map((slide, i) => (
        <div
          key={slide.image}
          aria-hidden={i !== index}
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
          style={{ backgroundImage: `url(${slide.image})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/20" />
          <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/70">
                {slide.eyebrow}
              </p>
              <p className="font-display text-lg text-white">{slide.title}</p>
            </div>
            <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
              {slide.badge}
            </span>
          </div>
        </div>
      ))}

      <div className="absolute left-5 top-5 flex gap-1.5">
        {heroSlides.map((slide, i) => (
          <button
            key={slide.image}
            type="button"
            aria-label={`Ver ${slide.eyebrow}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-6 bg-primary" : "w-3 bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}



function Hero() {
  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 70% 30%, oklch(0.82 0.13 82 / 0.18), transparent 70%), radial-gradient(50% 40% at 20% 80%, oklch(0.55 0.22 285 / 0.12), transparent 70%)",
        }}
      />
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:items-center">
        {/* LEFT — text */}
        <div className="animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-1/60 px-3 py-1.5 backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Novo · Marca Milionária Legacy · 4 set, 20:30
            </span>
          </div>

          <h1 className="mt-6 font-display text-5xl leading-[0.95] tracking-tight sm:text-6xl lg:text-[76px]">
            O ecossistema privado
            <br />
            para a tua{" "}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-b from-primary to-gold-deep bg-clip-text text-transparent">
                marca milionária
              </span>
            </span>
            .
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Cursos, MM Inteligence, comunidade, lives e ferramentas — desenhados
            como um único produto. Para empreendedores portugueses que exigem
            padrão.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              to="/aplicacao"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_40px_-10px_oklch(0.82_0.13_82_/_0.6)] hover:bg-gold-soft transition-all"
            >
              Enviar aplicação
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#academia"
              className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3.5 text-sm font-medium hover:bg-surface-1 transition-colors"
            >
              Explorar plataforma
            </a>
          </div>

          <dl className="mt-14 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-8">
            {[
              ["+2.400", "membros"],
              ["+120", "aulas"],
              ["4.9★", "satisfação"],
            ].map(([n, l]) => (
              <div key={l as string}>
                <dt className="font-display text-2xl text-foreground">{n}</dt>
                <dd className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* RIGHT — video mockup */}
        <div className="relative animate-fade-in [animation-delay:120ms]">
          <div className="relative aspect-[4/5] w-full">
            {/* halo */}
            <div
              aria-hidden
              className="absolute -inset-8 -z-10 rounded-[40px] blur-3xl opacity-70"
              style={{
                background:
                  "conic-gradient(from 210deg at 50% 50%, oklch(0.82 0.13 82 / 0.35), transparent 40%, oklch(0.55 0.22 285 / 0.25) 70%, transparent 100%)",
              }}
            />
            {/* device */}
            <div className="relative h-full w-full overflow-hidden rounded-[28px] border border-hairline bg-surface-1 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.6)]">
              <div className="flex items-center gap-1.5 border-b border-border bg-surface-2/50 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-foreground/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-foreground/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-foreground/20" />
                <span className="ml-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                  mmclub.pt / apresentação
                </span>
              </div>
              <HeroSlides />

            </div>

            {/* floating chip */}
            <div className="absolute -left-6 top-14 hidden rounded-2xl border border-hairline bg-surface-1/95 p-3 shadow-xl backdrop-blur md:flex items-center gap-3 animate-fade-in [animation-delay:400ms]">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="pr-1">
                <p className="text-xs font-semibold">MM Inteligence online</p>
                <p className="text-[10px] text-muted-foreground">Resposta em segundos</p>
              </div>
            </div>
            <div className="absolute -right-4 bottom-16 hidden rounded-2xl border border-hairline bg-surface-1/95 p-3 shadow-xl backdrop-blur md:flex items-center gap-3 animate-fade-in [animation-delay:600ms]">
              <div className="flex -space-x-2">
                {[avatar1, avatar5, avatar2].map((src, i) => (
                  <img
                    loading="lazy"
                    decoding="async"
                    key={i}
                    src={src}
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 rounded-full border-2 border-surface-1 object-cover"
                  />
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold">2.400+ membros ativos</p>
                <p className="text-[10px] text-muted-foreground">Portugal · Europa</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- TRUST STRIP ---------- */

function TrustStrip() {
  const items = ["Método Marca Milionária", "Comunidade privada", "MM Inteligence 24/7", "Lives semanais", "Ferramentas exclusivas"];
  return (
    <section className="border-y border-border py-8">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Um único ecossistema
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {items.map((t, i) => (
            <div key={t} className="flex items-center gap-3">
              <span className="font-display text-sm text-foreground/80">{t}</span>
              {i < items.length - 1 && <span className="hidden h-1 w-1 rounded-full bg-hairline md:block" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- FEATURE SECTION SHELL ---------- */

function FeatureSection({
  id,
  index,
  eyebrow,
  title,
  description,
  reverse,
  visual,
  bullets,
}: {
  id: string;
  index: string;
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  reverse?: boolean;
  visual: React.ReactNode;
  bullets: string[];
}) {
  return (
    <section id={id} className="relative py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-2 lg:gap-20 lg:items-center">
        <div className={reverse ? "lg:order-2" : ""}>
          <div className="flex items-center gap-3">
            <span className="font-display text-sm text-primary">{index}</span>
            <span className="h-px w-10 bg-hairline" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {eyebrow}
            </span>
          </div>
          <h2 className="mt-5 font-display text-4xl leading-[1.02] tracking-tight sm:text-5xl">
            {title}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {description}
          </p>
          <ul className="mt-8 space-y-3">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm">
                <span className="mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
                <span className="text-foreground/85">{b}</span>
              </li>
            ))}
          </ul>
          <div className="mt-9">
            <Link
              to="/aplicacao"
              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-foreground border-b border-hairline pb-1 hover:border-primary transition-colors"
            >
              Começar diagnóstico
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </div>
        <div className={`relative ${reverse ? "lg:order-1" : ""}`}>{visual}</div>
      </div>
    </section>
  );
}

/* ---------- MOCKUP FRAME ---------- */

function Mockup({ children, tint }: { children: React.ReactNode; tint?: string }) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-10 -z-10 rounded-[48px] blur-3xl opacity-60"
        style={{
          background:
            tint ??
            "radial-gradient(60% 60% at 50% 50%, oklch(0.82 0.13 82 / 0.25), transparent 70%)",
        }}
      />
      <div className="relative overflow-hidden rounded-3xl border border-hairline bg-surface-1 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.55)]">
        <div className="flex items-center gap-1.5 border-b border-border bg-surface-2/50 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

/* ---------- 01 ACADEMIA ---------- */

function FeatureAcademia() {
  return (
    <FeatureSection
      id="academia"
      index="01"
      eyebrow="Academia"
      title={
        <>
          Cursos que parecem<br />
          <span className="text-primary">masterclasses</span>.
        </>
      }
      description="Formação estruturada em módulos, com aulas de alta produção, materiais descarregáveis e progresso pessoal. Um novo módulo todos os meses."
      bullets={[
        "Percursos por objetivo: marca, oferta, tráfego, conversão",
        "Aulas em 4K, transcrições e recursos anexos",
        "Progresso salvo entre dispositivos",
      ]}
      visual={
        <Mockup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { t: "Fundamentos", n: "12 aulas", tone: "from-primary/40 to-primary/10", img: homeAula },
              { t: "Posicionamento", n: "8 aulas", tone: "from-violet/40 to-violet/10", img: homeLive },
              { t: "Oferta Milionária", n: "10 aulas", tone: "from-gold-soft/50 to-gold-soft/10", img: legacyCover.url },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl border border-border bg-surface-2/40 p-4">
                <div className={`aspect-video rounded-xl bg-gradient-to-br ${c.tone} mb-4 relative overflow-hidden`}>
                  <img src={c.img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
                    Módulo
                  </span>
                </div>
                <p className="text-sm font-semibold sm:text-base">{c.t}</p>
                <p className="text-xs text-muted-foreground">{c.n}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-border bg-surface-2/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">A ver agora</p>
                <p className="mt-0.5 text-sm font-semibold">03 · Arquitetura da tua oferta</p>
              </div>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                12:04 / 34:20
              </span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
              <div className="h-full w-[35%] rounded-full bg-primary" />
            </div>
          </div>
        </Mockup>
      }
    />
  );
}

/* ---------- 02 SUPORTE IA ---------- */

function FeatureJade() {
  return (
    <FeatureSection
      id="jade"
      index="02"
      eyebrow="MM Inteligence"
      reverse
      title={
        <>
          Um mentor <span className="text-primary">disponível</span>
          <br /> a qualquer hora.
        </>
      }
      description="MM Inteligence — assistente treinado no método Marca Milionária. Faz perguntas, pede feedback, valida ideias — como se tivesses o Rui contigo, 24/7."
      bullets={[
        "Contexto completo do método MM",
        "Sugestões acionáveis, não respostas genéricas",
        "Histórico privado e pesquisável",
      ]}
      visual={
        <Mockup tint="radial-gradient(60% 60% at 50% 50%, oklch(0.55 0.22 285 / 0.25), transparent 70%)">
          <div className="space-y-3">
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                Como estruturo uma oferta de €2.000 para consultoria?
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-gold-deep text-[10px] font-bold text-primary-foreground">
                IA
              </div>
              <div className="max-w-[85%] space-y-2 rounded-2xl rounded-bl-sm border border-border bg-surface-2/60 px-4 py-3 text-sm">
                <p>Aqui vai a arquitetura em 4 camadas:</p>
                <ol className="ml-4 list-decimal space-y-1 text-foreground/80">
                  <li>Promessa mensurável</li>
                  <li>Mecanismo único</li>
                  <li>Prova irrefutável</li>
                  <li>Risco invertido</li>
                </ol>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-1 h-7 w-7 rounded-full bg-gradient-to-br from-primary to-gold-deep" />
              <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-surface-2/60 px-3 py-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-full border border-border bg-surface-2/60 px-4 py-2.5">
            <input
              readOnly
              value="Escreve ao MM Inteligence…"
              className="flex-1 bg-transparent text-sm text-muted-foreground outline-none"
            />
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </Mockup>
      }
    />
  );
}

/* ---------- 03 COMUNIDADE ---------- */

function FeatureComunidade() {
  return (
    <FeatureSection
      id="comunidade"
      index="03"
      eyebrow="Comunidade"
      title={
        <>
          A comunidade da<br />
          <span className="text-primary">Marca Milionária</span>.
        </>
      }
      description="O espaço privado de quem segue a Marca Milionária. Partilhas vitórias, pedes feedback ao fundador e aos mentores MM e crias parcerias reais."
      bullets={[
        "Feed segmentado por tópicos e níveis",
        "Perfis verificados, sem ruído",
        "Mentores MM presentes: Brenda, Edmar, Dieisy e mais",
      ]}
      visual={
        <Mockup>
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
            <img src={homeAula} alt="Victor Muabi, fundador da Marca Milionária" loading="lazy" className="h-11 w-11 rounded-full object-cover object-top" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">Comunidade Marca Milionária</p>
              <p className="truncate text-[10px] text-muted-foreground">Com Victor Muabi · Brenda · Edmar · Dieisy · Sofia</p>
            </div>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Privada</span>
          </div>
          <div className="space-y-3">
            {[
              {
                n: "Sofia M.",
                r: "Consultora",
                t: "Acabei de fechar o primeiro cliente €5k. Obrigada MM Club — o módulo 03 mudou o meu pitch.",
                l: 42,
                c: 12,
              },
              {
                n: "André R.",
                r: "Fundador",
                t: "Alguém disponível para review de landing page? Feedback em troca de café ☕",
                l: 18,
                c: 27,
              },
            ].map((p, i) => (
              <div key={p.n} className="rounded-xl border border-border bg-surface-2/40 p-4">
                <div className="flex items-center gap-3">
                  <img
                    loading="lazy"
                    decoding="async"
                    src={i ? avatar2 : avatar1}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-xs font-semibold">{p.n}</p>
                    <p className="text-[10px] text-muted-foreground">{p.r} · há 2 h</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-foreground/85">{p.t}</p>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5" /> {p.l}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" /> {p.c}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Mockup>
      }
    />
  );
}

/* ---------- 04 LIVES ---------- */

function FeatureLives() {
  return (
    <FeatureSection
      id="lives"
      index="04"
      eyebrow="Lives"
      reverse
      title={
        <>
          Lives com o fundador e<br />
          <span className="text-primary">outros mentores MM</span>.
        </>
      }
      description="Todas as semanas, o Victor e mentores convidados — Meta Ads, agências com IA, e-commerce e copy. Perguntas em direto, gravações disponíveis para sempre."
      bullets={[
        "Calendário integrado com lembretes",
        "Q&A com prioridade para membros",
        "Biblioteca de replays organizada",
      ]}
      visual={
        <Mockup tint="radial-gradient(60% 60% at 50% 50%, oklch(0.82 0.13 82 / 0.28), transparent 70%)">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-primary/40 via-violet/20 to-transparent">
            <img src={homeLive} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
            <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-destructive/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              <Circle className="h-1.5 w-1.5 fill-current" /> Ao vivo
            </div>
            <div className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] text-white backdrop-blur">
              412 a ver
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-foreground shadow-2xl dark:bg-transparent dark:text-white dark:shadow-none">
                <Radio className="h-6 w-6" />
              </div>
            </div>
            <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-black/60 px-3 py-2 backdrop-blur">
              <p className="text-[10px] uppercase tracking-widest text-white/70">Live · Quinta 21h</p>
              <p className="text-sm font-semibold text-white">Como cobrar €10k por projeto</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {[
              { d: "Ter 21h", t: "Meta Ads que escalam", w: "Brenda", img: homeAula },
              { d: "Qui 21h", t: "Agência com IA", w: "Edmar", img: legacyCover.url },
              { d: "Sáb 11h", t: "Dropshipping LATAM", w: "Dieisy", img: homeLive },
            ].map(({ d, t, w, img }) => (
              <div key={t} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 px-3 py-2">
                <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md">
                  <img src={img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-widest text-primary">{d}</p>
                  <p className="truncate text-sm font-medium">{t}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">com {w}</span>
              </div>
            ))}
          </div>
        </Mockup>
      }
    />
  );
}

/* ---------- 05 FERRAMENTAS ---------- */

function FeatureFerramentas() {
  return (
    <FeatureSection
      id="ferramentas"
      index="05"
      eyebrow="Ferramentas"
      title={
        <>
          Toolkit prático para<br />
          <span className="text-primary">executares hoje</span>.
        </>
      }
      description="Templates, checklists, prompts e frameworks — prontos a usar. Nada de teoria vazia."
      bullets={[
        "+80 recursos descarregáveis",
        "Prompts otimizados para IA generativa",
        "Novos itens todas as semanas",
      ]}
      visual={
        <Mockup>
          <div className="grid grid-cols-2 gap-3">
            {[
              { t: "Prompt: Oferta de €5k", tag: "Prompt", tone: "bg-primary/15 text-primary" },
              { t: "Checklist: Lançamento", tag: "Checklist", tone: "bg-violet/15 text-violet" },
              { t: "Template: Página de venda", tag: "Template", tone: "bg-gold-soft/20 text-gold-deep" },
              { t: "Framework: Pricing", tag: "Framework", tone: "bg-primary/15 text-primary" },
            ].map((r) => (
              <div key={r.t} className="rounded-xl border border-border bg-surface-2/40 p-4">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${r.tone}`}>
                  {r.tag}
                </span>
                <p className="mt-3 text-sm font-semibold leading-snug">{r.t}</p>
                <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Atualizado</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </div>
            ))}
          </div>
        </Mockup>
      }
    />
  );
}

/* ---------- 06 EVENTOS ---------- */

function FeatureEventos() {
  return (
    <FeatureSection
      id="eventos"
      index="06"
      eyebrow="Eventos"
      reverse
      title={
        <>
          Encontros que criam<br />
          <span className="text-primary">as tuas próximas parcerias</span>.
        </>
      }
      description="Jantares em Lisboa, workshops no Porto, retiros anuais. Networking sem cringe."
      bullets={[
        "Eventos presenciais mensais",
        "Retiro anual só para membros",
        "Prioridade em bilhetes limitados",
      ]}
      visual={
        <Mockup>
          <div className="rounded-xl border border-hairline bg-gradient-to-br from-surface-2 to-surface-1 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-primary">Próximo evento</p>
                <p className="mt-1 font-display text-2xl">MM Dinner · Lisboa</p>
                <p className="mt-1 text-xs text-muted-foreground">28 Fev · 19h30 · Alfama</p>
              </div>
              <div className="text-right">
                <p className="font-display text-4xl text-primary">28</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Fev</p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
              <div className="flex -space-x-2">
                {[avatar4, avatar6, avatar3, avatar1].map((src, i) => (
                  <img key={i} src={src} alt="" loading="lazy" width={28} height={28} className="h-7 w-7 rounded-full border-2 border-surface-1 object-cover" />
                ))}
                <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface-1 bg-surface-3 text-[10px] font-semibold">
                  +18
                </span>
              </div>
              <span className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground">
                24 lugares · 6 restantes
              </span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[
              ["Workshop", "Porto · 14 Mar", <Calendar key="c1" />],
              ["Retiro", "Comporta · Mai", <Calendar key="c2" />],
            ].map(([t, d]) => (
              <div key={t as string} className="rounded-xl border border-border bg-surface-2/40 p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t}</p>
                <p className="mt-1 text-sm font-semibold">{d}</p>
              </div>
            ))}
          </div>
        </Mockup>
      }
    />
  );
}

/* ---------- MANIFESTO ---------- */

function Manifesto() {
  return (
    <section className="relative py-32">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">Manifesto</p>
        <p className="mt-8 font-display text-3xl leading-[1.15] sm:text-5xl">
          Acreditamos que o padrão do{" "}
          <span className="text-muted-foreground">empreendedorismo português</span>{" "}
          precisa de subir. E que isso começa com{" "}
          <span className="text-primary">quem se recusa a ser mediano</span>.
        </p>
        <div className="mt-10 inline-flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px w-10 bg-hairline" />
          Rui · fundador, Marca Milionária
          <span className="h-px w-10 bg-hairline" />
        </div>
      </div>
    </section>
  );
}

/* ---------- FINAL CTA ---------- */

function FinalCTA() {
  return (
    <section id="aderir" className="relative py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div
          className="relative overflow-hidden rounded-[32px] border border-hairline p-10 sm:p-16"
          style={{
            background:
              "radial-gradient(120% 100% at 0% 0%, oklch(0.82 0.13 82 / 0.18), transparent 55%), radial-gradient(120% 100% at 100% 100%, oklch(0.55 0.22 285 / 0.18), transparent 55%), var(--surface-1)",
          }}
        >
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                Comunidade Marca Milionária
              </p>
              <h2 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
                Um único acesso.<br />
                Todo o ecossistema.
              </h2>
              <p className="mt-5 max-w-lg text-muted-foreground">
                Envia a tua aplicação. A nossa equipa analisa o teu perfil e entra em contacto contigo.
              </p>
              <ul className="mt-7 grid gap-2 text-sm sm:grid-cols-2">
                {[
                  "Todos os cursos e módulos",
                  "MM Inteligence ilimitado",
                  "Comunidade privada",
                  "Lives + replays",
                  "Ferramentas e templates",
                  "Eventos presenciais",
                ].map((i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-start gap-4 lg:items-end">
              <Link
                to="/aplicacao"
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground shadow-[0_20px_60px_-20px_oklch(0.82_0.13_82_/_0.7)] hover:bg-gold-soft transition-all"
              >
                Enviar aplicação
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/auth"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Já sou membro — Entrar
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- FOOTER ---------- */

function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <MMLogo />
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <Link to="/termos" className="hover:text-foreground">Termos</Link>
            <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
            <Link to="/reembolsos" className="hover:text-foreground">Reembolsos</Link>
            <a href="mailto:geral@mmclub.pt" className="hover:text-foreground">Contacto</a>
          </nav>
        </div>
        <div className="mt-8 border-t border-border pt-6 text-center text-xs leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">Kambafy, LLC</p>
          <p>EIN 38-4416614</p>
          <p>7345 W Sand Lake Rd, Ste 210, Office 1331, Orlando, FL 32819, United States</p>
          <p>
            <a href="mailto:geral@mmclub.pt" className="hover:text-foreground">geral@mmclub.pt</a>
          </p>
        </div>
        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          © {new Date().getFullYear()} MM Club · Marca Milionária
        </p>
      </div>
    </footer>
  );
}
