import { motion, AnimatePresence } from "motion/react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import avatar1 from "@/assets/avatar-1.jpg";
import avatar2 from "@/assets/avatar-2.jpg";
import avatar3 from "@/assets/avatar-3.jpg";
import avatar5 from "@/assets/avatar-5.jpg";

const WELCOME_VIDEO_ID = "J-ivFkMIHCQ";

/* ---------- Hand-drawn arrows ---------- */

const ArrowGoldLeft = () => (
  <svg viewBox="0 0 120 60" fill="none" className="h-full w-full">
    <path
      d="M4 30 C 35 8, 70 8, 110 22"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M100 14 L 112 22 L 100 30"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const ArrowGoldRight = () => (
  <svg viewBox="0 0 120 60" fill="none" className="h-full w-full">
    <path
      d="M116 34 C 85 52, 50 52, 10 38"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M20 46 L 8 38 L 20 30"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const ArrowInk = ({ flip = false }: { flip?: boolean }) => (
  <svg
    viewBox="0 0 80 40"
    fill="none"
    className="h-full w-full"
    style={flip ? { transform: "scaleX(-1)" } : undefined}
  >
    <path
      d="M4 20 C 25 4, 55 4, 74 20"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M66 12 L 76 20 L 66 28"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

/* ---------- Rotating badge ---------- */

const CircularBadge = () => (
  <div className="relative h-24 w-24 sm:h-36 sm:w-36">
    <motion.svg
      viewBox="0 0 160 160"
      className="absolute inset-0 text-foreground"
      animate={{ rotate: 360 }}
      transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
    >
      <defs>
        <path id="badge-circle" d="M 80,80 m -62,0 a 62,62 0 1,1 124,0 a 62,62 0 1,1 -124,0" />
      </defs>
      <text className="fill-current text-[11px] font-semibold uppercase tracking-[0.28em]">
        <textPath href="#badge-circle" startOffset="0">
          Adere ao MM Club • Adere ao MM Club •{" "}
        </textPath>
      </text>
    </motion.svg>
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex h-11 w-11 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_30px_-8px_oklch(0.82_0.13_82_/_0.7)]">
        <ArrowRight className="h-4 w-4 sm:h-6 sm:w-6 -rotate-45" strokeWidth={2.4} />
      </div>
    </div>
  </div>
);

/* ---------- Glass card ---------- */

function GlassCard({
  name,
  points,
  gradient,
  className,
  delay = 0,
}: {
  name: string;
  points: string;
  gradient: string;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`absolute z-20 flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-white/15 bg-background/50 p-2 pr-3 sm:p-3 sm:pr-5 backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)] ${className}`}
    >
      <div
        className="h-7 w-7 sm:h-10 sm:w-10 shrink-0 rounded-lg sm:rounded-xl"
        style={{ background: gradient }}
      />
      <div>
        <p className="font-display text-[11px] sm:text-sm leading-tight text-foreground">{name}</p>
        <p className="text-[9px] sm:text-[11px] text-muted-foreground">{points}</p>
      </div>
    </motion.div>
  );
}

/* ---------- Big Type Stack Hero ---------- */

export function BigTypeHero() {
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  useEffect(() => {
    if (!welcomeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWelcomeOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [welcomeOpen]);

  const stackAnim = {
    hidden: { opacity: 0, y: 40 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.9, delay: 0.1 + i * 0.12, ease: [0.22, 1, 0.36, 1] as const },
    }),
  };

  return (
    <section className="relative overflow-hidden pt-20 pb-14 sm:pt-28 sm:pb-20">

      {/* background grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(to right, oklch(1 0 0 / 0.04) 1px, transparent 1px), linear-gradient(to bottom, oklch(1 0 0 / 0.04) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 45%, black 40%, transparent 85%)",
        }}
      />
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(50% 40% at 50% 20%, oklch(0.82 0.13 82 / 0.22), transparent 70%), radial-gradient(40% 30% at 20% 90%, oklch(0.55 0.22 285 / 0.18), transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-[1180px] px-4 sm:px-8">
        {/* intro tag + CTA */}
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-1/60 px-4 py-2 backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Clube privado · Temporada 2026
            </span>
          </div>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
            O ecossistema privado da Marca Milionária. Cursos, Suporte IA,
            comunidade, lives e ferramentas — num único acesso.
          </p>
        </div>

        {/* massive type stack + overlays */}
        <div className="relative mt-14 sm:mt-20">
          {/* type */}
          <div className="relative z-0 flex flex-col items-center gap-1 leading-[1.02] sm:gap-2 sm:leading-[1]">
            <motion.h1
              custom={0}
              initial="hidden"
              animate="show"
              variants={stackAnim}
              className="font-display text-[7.6vw] font-extrabold tracking-tight text-foreground/85 sm:text-[6.4vw] md:text-[5.2vw] lg:text-[4.6rem]"
              style={{ fontSize: "clamp(1.85rem, 5.4vw, 4rem)" }}
            >
              #CLUB
            </motion.h1>
            <motion.h1
              custom={1}
              initial="hidden"
              animate="show"
              variants={stackAnim}
              className="font-display text-[7.6vw] font-extrabold tracking-tight text-transparent sm:text-[6.4vw] md:text-[5.2vw] lg:text-[4.6rem]"
              style={{ fontSize: "clamp(1.85rem, 5.4vw, 4rem)", WebkitTextStroke: "1px var(--gold)" }}
            >
              MARCA
            </motion.h1>
            <motion.h1
              custom={2}
              initial="hidden"
              animate="show"
              variants={stackAnim}
              className="font-display text-[6.6vw] font-extrabold tracking-tight sm:text-[5.7vw] md:text-[4.7vw] lg:text-[4.25rem]"
              style={{
                fontSize: "clamp(1.55rem, 4.7vw, 3.75rem)",
                background: "linear-gradient(180deg, var(--gold-soft), var(--gold-deep))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              MILIONÁRIA
            </motion.h1>
          </div>




          {/* Decorative arrows */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.9 }}
            className="absolute left-[8%] top-[8%] z-10 hidden h-14 w-28 text-primary sm:block"
          >
            <ArrowGoldLeft />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 1.0 }}
            className="absolute right-[10%] top-[62%] z-10 hidden h-14 w-28 text-primary sm:block"
          >
            <ArrowGoldRight />
          </motion.div>

          {/* Circular badge — desktop only */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-[10%] bottom-[-4%] z-20 hidden sm:block"
          >
            <Link to="/quiz" aria-label="Fazer diagnóstico MM Club">
              <CircularBadge />
            </Link>
          </motion.div>
        </div>

        {/* Play temporariamente oculto */}


        {/* CTA row */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4 sm:mt-14">
          <Link
            to="/quiz"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground shadow-[0_20px_60px_-20px_oklch(0.82_0.13_82_/_0.7)] hover:bg-gold-soft transition-all"
          >
            Fazer diagnóstico
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#pilares"
            className="inline-flex items-center gap-2 rounded-full border border-border px-7 py-4 text-sm font-medium hover:bg-surface-1 transition-colors"
          >
            Ver por dentro
          </a>
        </div>
      </div>

      <AnimatePresence>
        {welcomeOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
            onClick={() => setWelcomeOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-5xl overflow-hidden rounded-2xl bg-black shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setWelcomeOpen(false)}
                aria-label="Fechar"
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/15 transition hover:bg-black/80"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="relative aspect-video w-full">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${WELCOME_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                  title="Boas-vindas ao MM Club"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full border-0"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Bottom three-card system */}
      <div id="pilares" className="mx-auto mt-24 max-w-[1180px] px-4 sm:mt-32 sm:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Card 1 — Academia */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative rounded-3xl border border-hairline bg-surface-1 p-6 sm:p-8"
          >
            <h3 className="font-display text-2xl leading-tight sm:text-3xl">
              ENTRA NA
              <br />
              ACADEMIA
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              cursos novos todos os meses, do zero ao €10k/mês
            </p>
            <div className="mt-8 flex items-center justify-between rounded-2xl border border-border bg-surface-2/60 p-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="h-9 w-9 rounded-xl"
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.82 0.13 82), oklch(0.58 0.14 68))",
                  }}
                />
                <div>
                  <p className="font-display text-sm">rui.mm</p>
                  <p className="text-[10px] text-muted-foreground">Fundamentos · 12 aulas</p>
                </div>
              </div>
              <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-semibold text-primary">
                Módulo 03
              </span>
            </div>
            {/* Arrow to next */}
            <div className="absolute -right-4 top-1/2 z-10 hidden h-10 w-16 -translate-y-1/2 text-foreground md:block">
              <ArrowInk />
            </div>
          </motion.div>

          {/* Card 2 — Suporte IA */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative rounded-3xl border border-hairline bg-surface-1 p-6 sm:p-8"
          >
            <h3 className="font-display text-2xl leading-tight sm:text-3xl">
              PERGUNTA À
              <br />
              SUPORTE IA
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              mentor treinado no método MM, disponível 24/7
            </p>
            <div className="mt-8 flex items-center justify-between rounded-2xl border border-border bg-surface-2/60 p-3">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-primary px-2.5 py-1 font-display text-sm font-semibold text-primary-foreground">
                  20.24
                </div>
                <span className="text-xs font-medium">respostas/dia</span>
              </div>
              {/* floating pill */}
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-[10px] font-semibold text-primary">online</span>
              </motion.div>
            </div>
            <div className="absolute -right-4 top-1/2 z-10 hidden h-10 w-16 -translate-y-1/2 text-foreground md:block">
              <ArrowInk />
            </div>
          </motion.div>

          {/* Card 3 — Comunidade */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative rounded-3xl border border-hairline bg-surface-1 p-6 sm:p-8"
          >
            <h3 className="font-display text-2xl leading-tight sm:text-3xl">
              FICA NA
              <br />
              COMUNIDADE
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              rede privada de empreendedores portugueses
            </p>
            <div className="mt-8 rounded-2xl border border-border bg-surface-2/60 p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Membros ativos
              </p>
              <p className="mt-1 font-display text-3xl">2.412</p>
              <div className="mt-3 flex -space-x-2">

                {[avatar1, avatar3, avatar5, avatar2].map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    loading="lazy"
                    width={24}
                    height={24}
                    className="h-6 w-6 rounded-full border-2 border-surface-1 object-cover"
                  />
                ))}
                <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface-1 bg-surface-3 text-[9px] font-semibold">
                  +2k
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
