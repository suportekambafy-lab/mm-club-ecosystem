import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Check,
  Play,
  Quote,
  Users,
  Timer,
  Compass,
} from "lucide-react";
import { MMLogo } from "@/components/mm/logo";
import { cn } from "@/lib/utils";
import gallery1 from "@/assets/studio-showcase-1.jpg";
import gallery2 from "@/assets/studio-showcase-2.jpg";
import gallery3 from "@/assets/studio-showcase-3.jpg";
import gallery4 from "@/assets/studio-showcase-4.jpg";
import gallery5 from "@/assets/studio-showcase-5.jpg";
import gallery6 from "@/assets/studio-showcase-6.jpg";
import avatar1 from "@/assets/avatar-1.jpg";
import avatar2 from "@/assets/avatar-2.jpg";
import avatar3 from "@/assets/avatar-3.jpg";
import avatar4 from "@/assets/avatar-4.jpg";
import avatar5 from "@/assets/avatar-5.jpg";

export const Route = createFileRoute("/quiz")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Diagnóstico MM Club — Descobre o teu perfil e plano ideal" },
      {
        name: "description",
        content:
          "Responde a 6 perguntas e descobre o teu perfil de empreendedor e o plano MM Club certo para o teu momento. Menos de 1 minuto.",
      },
      { property: "og:title", content: "Diagnóstico MM Club" },
      {
        property: "og:description",
        content:
          "Descobre o teu perfil de empreendedor e o plano ideal para acelerares os teus resultados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuizPage,
});

/* ---------------- Configuração de vídeos ----------------
   Assim que tiveres os vídeos gravados, coloca aqui os URLs
   (Bunny/Cloudflare/MP4 direto). Sem URL, mostramos o guião
   em cartão animado — a experiência continua a funcionar. */
const VIDEO_SOURCES: Record<string, string | null> = {
  intro: null,
  direcao: null,
  depoimento: null,
};

type Weight = { start: number; plus: number; elite: number };

type Choice = { id: string; label: string; hint?: string; weight: Weight };

type QuestionBeat = {
  kind: "question";
  key: string;
  kicker: string;
  title: string;
  description?: string;
  stat?: string;
  choices: Choice[];
};

type VideoBeat = {
  kind: "video";
  key: string;
  kicker: string;
  speaker: string;
  script: string;
  duration: string;
  cta: string;
};

type GalleryBeat = { kind: "gallery"; key: string };

type Beat = QuestionBeat | VideoBeat | GalleryBeat;

const allBeats: Beat[] = [
  {
    kind: "video",
    key: "v-intro",
    kicker: "Antes de começarmos",
    speaker: "Victor",
    duration: "20s",
    script:
      "Antes de te recomendar qualquer plano, preciso de perceber onde estás neste momento. Não quero que escolhas algo errado.",
    cta: "Continuar",
  },
  {
    kind: "question",
    key: "situacao",
    kicker: "Pergunta 1",
    title: "Qual descreve melhor a tua situação?",
    stat: "Mais de 2.000 empreendedores já responderam a este diagnóstico.",
    choices: [
      { id: "start", label: "Ainda quero começar online", weight: { start: 3, plus: 1, elite: 0 } },
      { id: "inconsistent", label: "Já vendo, mas de forma inconsistente", weight: { start: 1, plus: 3, elite: 1 } },
      { id: "scale", label: "Tenho negócio e quero escalar", weight: { start: 0, plus: 2, elite: 3 } },
      { id: "automate", label: "Quero automatizar e ganhar tempo", weight: { start: 0, plus: 2, elite: 3 } },
    ],
  },
  {
    kind: "question",
    key: "bloqueio",
    kicker: "Pergunta 2",
    title: "Qual é hoje o teu maior bloqueio?",
    stat: "87% dos membros disseram que o maior bloqueio era a falta de direção.",
    choices: [
      { id: "where", label: "Não sei por onde começar", weight: { start: 3, plus: 1, elite: 0 } },
      { id: "clients", label: "Falta de clientes", weight: { start: 1, plus: 3, elite: 1 } },
      { id: "strategy", label: "Falta de estratégia", weight: { start: 1, plus: 3, elite: 2 } },
      { id: "consistency", label: "Falta de consistência", weight: { start: 2, plus: 3, elite: 1 } },
      { id: "time", label: "Falta de tempo", weight: { start: 0, plus: 2, elite: 3 } },
    ],
  },
  {
    kind: "video",
    key: "v-direcao",
    kicker: "Um segundo",
    speaker: "Victor",
    duration: "18s",
    script:
      "Sabes qual é o maior erro? Pensar que o problema é a ferramenta. Normalmente o problema é não ter direção.",
    cta: "Continuar",
  },
  {
    kind: "question",
    key: "tempo",
    kicker: "Pergunta 3",
    title: "Quanto tempo consegues dedicar por semana?",
    choices: [
      { id: "lt3", label: "Menos de 3 horas", weight: { start: 3, plus: 1, elite: 0 } },
      { id: "3_5", label: "3 a 5 horas", weight: { start: 2, plus: 3, elite: 1 } },
      { id: "5_10", label: "5 a 10 horas", weight: { start: 1, plus: 3, elite: 2 } },
      { id: "gt10", label: "Mais de 10 horas", weight: { start: 0, plus: 2, elite: 3 } },
    ],
  },
  {
    kind: "question",
    key: "procura",
    kicker: "Pergunta 4",
    title: "O que procuras mais neste momento?",
    choices: [
      { id: "learn", label: "Aprender", weight: { start: 3, plus: 2, elite: 0 } },
      { id: "coach", label: "Acompanhamento", weight: { start: 0, plus: 2, elite: 3 } },
      { id: "community", label: "Comunidade", weight: { start: 1, plus: 3, elite: 1 } },
      { id: "tools", label: "Ferramentas", weight: { start: 1, plus: 3, elite: 2 } },
      { id: "network", label: "Networking", weight: { start: 0, plus: 2, elite: 3 } },
    ],
  },
  { kind: "gallery", key: "album" },
  {
    kind: "question",
    key: "crenca",
    kicker: "Pergunta 5",
    title:
      "Se tivesses acesso semanal a estratégias práticas, comunidade e acompanhamento, acreditas que conseguirias avançar mais rápido?",
    choices: [
      { id: "yes", label: "Sim", weight: { start: 1, plus: 3, elite: 2 } },
      { id: "maybe", label: "Talvez", weight: { start: 2, plus: 2, elite: 1 } },
      { id: "unsure", label: "Não tenho a certeza", weight: { start: 3, plus: 1, elite: 0 } },
    ],
  },
  {
    kind: "video",
    key: "v-depoimento",
    kicker: "Depoimento de membro",
    speaker: "Membro MM Club",
    duration: "30s",
    script:
      "Eu entrei sem saber exatamente o que esperar… ao fim de três semanas tinha uma direção clara e os primeiros clientes a chegar.",
    cta: "Continuar",
  },
  {
    kind: "question",
    key: "objetivo",
    kicker: "Pergunta 6",
    title: "Qual é o teu objetivo para os próximos 12 meses?",
    choices: [
      { id: "first", label: "Primeiro cliente", weight: { start: 3, plus: 1, elite: 0 } },
      { id: "1k", label: "1.000 € / mês", weight: { start: 3, plus: 2, elite: 0 } },
      { id: "5k", label: "5.000 € / mês", weight: { start: 0, plus: 3, elite: 1 } },
      { id: "scale", label: "Escalar empresa", weight: { start: 0, plus: 1, elite: 3 } },
      { id: "auto", label: "Automatizar processos", weight: { start: 0, plus: 2, elite: 3 } },
    ],
  },
];

const beats: Beat[] = allBeats.filter((b) => b.kind === "question");

const questionCount = beats.filter((b) => b.kind === "question").length;

const profiles = {
  start: {
    name: "Construtor",
    line: "Estás a construir a base. O teu ganho maior agora é clareza: um caminho, um passo de cada vez, sem ruído.",
    plan: {
      id: "start",
      name: "MM Club Start",
      tagline: "Base sólida para começares hoje.",
      description:
        "Academia completa, comunidade e ferramentas ao teu ritmo — para transformares intenção em primeiros resultados.",
      price: "29,90 € / mês",
    },
  },
  plus: {
    name: "Executor",
    line: "Já tens sinais de mercado. O que te falta é ritmo e método — repetir o que funciona até ficar consistente.",
    plan: {
      id: "plus",
      name: "MM Club Plus",
      tagline: "O ritmo certo para acelerar.",
      description:
        "Lives semanais, comunidade ativa e método aplicado — para deixares de vender por sorte e passares a vender por sistema.",
      price: "149,90 € / 6 meses",
    },
  },
  elite: {
    name: "Escalador",
    line: "Já operas. Agora é sobre alavancagem: sistemas, networking certo e decisões de dono, não de operador.",
    plan: {
      id: "elite",
      name: "MM Club Elite",
      tagline: "Ambição sem tecto.",
      description:
        "Acesso total durante um ano, acompanhamento próximo e networking com quem já está a escalar.",
      price: "249,90 € / ano",
    },
  },
} as const;

type PlanKey = keyof typeof profiles;

function computeResult(answers: Record<string, Choice>) {
  const total = { start: 0, plus: 0, elite: 0 };
  for (const c of Object.values(answers)) {
    total.start += c.weight.start;
    total.plus += c.weight.plus;
    total.elite += c.weight.elite;
  }
  const winner = (Object.entries(total).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "plus") as PlanKey;
  return { winner, total };
}

const galleryImages = [gallery1, gallery2, gallery3, gallery4, gallery5, gallery6];
const memberAvatars = [avatar1, avatar2, avatar3, avatar4, avatar5];

const testimonials = [
  {
    name: "Rita M.",
    role: "Serviços digitais",
    quote:
      "Em duas semanas tinha uma oferta clara e o primeiro cliente fechado. A diferença foi ter direção.",
    avatar: avatar2,
  },
  {
    name: "Tiago F.",
    role: "E-commerce",
    quote:
      "As lives valem por si só. Levo sempre uma decisão prática para aplicar no dia seguinte.",
    avatar: avatar4,
  },
  {
    name: "Ana C.",
    role: "Consultoria",
    quote: "A comunidade é o que me mantém consistente. Já não estou a fazer isto sozinha.",
    avatar: avatar5,
  },
];

const easing = [0.22, 1, 0.36, 1] as const;

/* ---------------- Página ---------------- */

type Phase = "landing" | "flow" | "analysis" | "result";

function QuizPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("landing");
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Choice>>({});

  const beat = beats[i];
  const answeredCount = Object.keys(answers).length;
  const progress =
    phase === "landing" ? 0 : phase === "flow" ? (i + 1) / (beats.length + 1) : 1;

  const result = useMemo(
    () => (phase === "result" || phase === "analysis" ? computeResult(answers) : null),
    [phase, answers],
  );
  const profile = result ? profiles[result.winner] : null;

  function advance() {
    if (i < beats.length - 1) setI(i + 1);
    else setPhase("analysis");
  }

  function selectChoice(c: Choice) {
    if (beat.kind !== "question") return;
    setAnswers((a) => ({ ...a, [beat.key]: c }));
    window.setTimeout(advance, 240);
  }

  function goBack() {
    if (phase === "result") {
      setPhase("flow");
      setI(beats.length - 1);
      return;
    }
    if (i > 0) setI(i - 1);
    else setPhase("landing");
  }

  function restart() {
    setAnswers({});
    setI(0);
    setPhase("landing");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Atmosphere />

      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/" aria-label="MM Club">
          <MMLogo />
        </Link>
        <Link
          to="/"
          className="text-xs text-muted-foreground transition hover:text-foreground"
        >
          Sair do diagnóstico
        </Link>
      </header>

      {phase !== "landing" && (
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            <span>
              {phase === "flow"
                ? beat.kind === "question"
                  ? `Passo ${answeredCountLabel(i)} de ${questionCount}`
                  : "Momento MM"
                : "Concluído"}
            </span>
            <span>
              {phase === "flow" && answeredCount < questionCount
                ? "Falta menos de 1 minuto"
                : `${Math.round(progress * 100)}%`}
            </span>
          </div>
          <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-surface-2">
            <motion.div
              initial={false}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.6, ease: easing }}
              className="h-full rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, oklch(0.82 0.13 82), oklch(0.58 0.14 68))",
              }}
            />
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-6 py-12 md:py-16">
        <AnimatePresence mode="wait">
          {phase === "landing" && (
            <Section key="landing">
              <Landing onStart={() => setPhase("flow")} />
            </Section>
          )}

          {phase === "flow" && beat.kind === "video" && (
            <Section key={beat.key}>
              <VideoStep beat={beat} onNext={advance} onBack={goBack} />
            </Section>
          )}

          {phase === "flow" && beat.kind === "gallery" && (
            <Section key={beat.key}>
              <GalleryStep onNext={advance} onBack={goBack} />
            </Section>
          )}

          {phase === "flow" && beat.kind === "question" && (
            <Section key={beat.key}>
              <QuestionStep
                beat={beat}
                selectedId={answers[beat.key]?.id}
                onSelect={selectChoice}
                onBack={goBack}
              />
            </Section>
          )}

          {phase === "analysis" && (
            <Section key="analysis">
              <AnalysisStep onDone={() => setPhase("result")} />
            </Section>
          )}

          {phase === "result" && profile && result && (
            <Section key="result">
              <ResultStep
                profile={profile}
                total={result.total}
                winner={result.winner}
                onRestart={restart}
                onGo={() =>
                  navigate({ to: "/checkout", search: { plan: result.winner } })
                }
              />
            </Section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function answeredCountLabel(index: number) {
  return beats.slice(0, index + 1).filter((b) => b.kind === "question").length || 1;
}

/* ---------------- Blocos ---------------- */

function Section({ children, ...rest }: { children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: easing }}
      {...rest}
    >
      {children}
    </motion.section>
  );
}

function Atmosphere() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(50% 40% at 70% 10%, oklch(0.82 0.13 82 / 0.18), transparent 70%), radial-gradient(40% 30% at 15% 90%, oklch(0.55 0.22 285 / 0.14), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(to right, oklch(1 0 0 / 0.03) 1px, transparent 1px), linear-gradient(to bottom, oklch(1 0 0 / 0.03) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 40%, black 40%, transparent 85%)",
        }}
      />
    </>
  );
}

function SocialProofRow() {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
      <div className="flex shrink-0 -space-x-2">
        {memberAvatars.map((src, idx) => (
          <img
            key={idx}
            src={src}
            alt=""
            aria-hidden
            loading="lazy"
            className="h-7 w-7 shrink-0 rounded-full border-2 border-background object-cover sm:h-8 sm:w-8"
          />
        ))}
      </div>
      <p className="min-w-0 text-[11px] leading-snug text-muted-foreground sm:text-xs">
        Mais de 2.000 empreendedores já responderam a este diagnóstico.
      </p>
    </div>
  );
}

function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="py-6 md:py-12">
      <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-primary">
        Diagnóstico MM Club
      </p>
      <h1 className="mt-5 max-w-3xl font-display text-4xl leading-[1.02] tracking-tight md:text-6xl">
        Descobre qual é o plano ideal para{" "}
        <span
          className="inline-block bg-clip-text text-transparent"
          style={{
            backgroundImage:
              "linear-gradient(180deg, var(--gold-soft), var(--gold-deep))",
          }}
        >
          acelerares os teus resultados
        </span>
        .
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Responde a algumas perguntas. No final vou recomendar o plano mais indicado
        para o teu momento atual.
      </p>

      <div className="mt-9 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onStart}
          className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground shadow-[0_20px_60px_-20px_oklch(0.82_0.13_82_/_0.7)] transition hover:bg-gold-soft"
        >
          Começar agora
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Timer className="h-3.5 w-3.5" /> Menos de 1 minuto · 6 perguntas
        </span>
      </div>

      <div className="mt-10">
        <SocialProofRow />
      </div>
    </div>
  );
}

function VideoStep({
  beat,
  onNext,
  onBack,
}: {
  beat: VideoBeat;
  onNext: () => void;
  onBack: () => void;
}) {
  const src = VIDEO_SOURCES[beat.key.replace("v-", "")] ?? null;
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-primary">
        {beat.kicker}
      </p>

      <div className="mt-6 overflow-hidden rounded-3xl border border-hairline bg-surface-1">
        <div className="relative aspect-video w-full">
          {src ? (
            <video
              src={src}
              controls
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center">
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(60% 60% at 50% 30%, oklch(0.82 0.13 82 / 0.16), transparent 70%)",
                }}
              />
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_18px_50px_-14px_oklch(0.82_0.13_82_/_0.8)]"
              >
                <Play className="h-5 w-5" fill="currentColor" />
              </motion.div>
              <p className="relative max-w-xl font-display text-xl leading-snug md:text-3xl">
                “{beat.script}”
              </p>
              <p className="relative text-xs uppercase tracking-[0.24em] text-muted-foreground">
                {beat.speaker} · {beat.duration}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Anterior
        </button>
        <button
          type="button"
          onClick={onNext}
          className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition hover:bg-gold-soft"
        >
          {beat.cta}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

function GalleryStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {galleryImages.map((src, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: idx * 0.07, ease: easing }}
            className={cn(
              "overflow-hidden rounded-2xl border border-hairline bg-surface-1",
              idx === 0 && "col-span-2 row-span-2 md:col-span-2",
            )}
          >
            <img
              src={src}
              alt=""
              aria-hidden
              loading="lazy"
              className="h-full w-full object-cover"
              style={{ aspectRatio: idx === 0 ? "16/11" : "1/1" }}
            />
          </motion.div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Anterior
        </button>
        <button
          type="button"
          onClick={onNext}
          className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition hover:bg-gold-soft"
        >
          Continuar
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

function QuestionStep({
  beat,
  selectedId,
  onSelect,
  onBack,
}: {
  beat: QuestionBeat;
  selectedId?: string;
  onSelect: (c: Choice) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-hairline bg-surface-1 text-primary">
          <Compass className="h-5 w-5" />
        </div>
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-primary">
          {beat.kicker}
        </p>
      </div>

      <h1 className="max-w-3xl font-display text-3xl leading-[1.06] tracking-tight md:text-5xl">
        {beat.title}
      </h1>
      {beat.description && (
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          {beat.description}
        </p>
      )}

      <div className="mt-10 grid gap-3 md:grid-cols-2">
        {beat.choices.map((c, idx) => {
          const selected = selectedId === c.id;
          return (
            <motion.button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.05, ease: easing }}
              className={cn(
                "group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border p-5 text-left transition-all",
                selected
                  ? "border-primary bg-primary/8 shadow-[0_20px_60px_-20px_oklch(0.82_0.13_82_/_0.45)]"
                  : "border-border bg-surface-1 hover:border-[color:var(--hairline)] hover:-translate-y-0.5",
              )}
            >
              <div className="min-w-0">
                <p className="font-display text-base leading-tight text-foreground md:text-lg">
                  {c.label}
                </p>
                {c.hint && (
                  <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
                )}
              </div>
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground group-hover:text-foreground",
                )}
              >
                {selected ? (
                  <Check className="h-4 w-4" strokeWidth={2.6} />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-10 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Anterior
        </button>
        {beat.stat && (
          <p className="text-right text-xs text-muted-foreground">{beat.stat}</p>
        )}
      </div>
    </div>
  );
}

const analysisLines = [
  "A cruzar a tua fase de negócio…",
  "A comparar com 2.000+ diagnósticos…",
  "A definir o teu perfil…",
];

function AnalysisStep({ onDone }: { onDone: () => void }) {
  const [line, setLine] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const t1 = window.setInterval(
      () => setLine((l) => Math.min(l + 1, analysisLines.length - 1)),
      900,
    );
    const t2 = window.setTimeout(() => doneRef.current(), 2800);
    return () => {
      window.clearInterval(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return (
    <div className="flex flex-col items-center py-10 text-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        className="flex h-14 w-14 items-center justify-center rounded-2xl border border-hairline bg-surface-1 text-primary"
      >
        <Sparkles className="h-6 w-6" />
      </motion.div>
      <h2 className="mt-7 font-display text-3xl md:text-4xl">
        Estamos a analisar as tuas respostas…
      </h2>
      <AnimatePresence mode="wait">
        <motion.p
          key={line}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
          className="mt-3 text-sm text-muted-foreground"
        >
          {analysisLines[line]}
        </motion.p>
      </AnimatePresence>

      <div className="mt-10 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
        {[
          { k: "2.000+", v: "diagnósticos feitos" },
          { k: "87%", v: "bloqueados por falta de direção" },
          { k: "4 lives", v: "por mês com o Victor" },
        ].map((s) => (
          <div
            key={s.k}
            className="rounded-2xl border border-border bg-surface-1 p-4"
          >
            <p className="font-display text-2xl text-foreground">{s.k}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <SocialProofRow />
      </div>
    </div>
  );
}

function ResultStep({
  profile,
  total,
  winner,
  onGo,
  onRestart,
}: {
  profile: (typeof profiles)[PlanKey];
  total: { start: number; plus: number; elite: number };
  winner: PlanKey;
  onGo: () => void;
  onRestart: () => void;
}) {
  const max = Math.max(1, total.start, total.plus, total.elite);
  return (
    <div>
      {/* Perfil primeiro — sem preço */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_30px_-8px_oklch(0.82_0.13_82_/_0.7)]">
          <Sparkles className="h-5 w-5" />
        </div>
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-primary">
          Diagnóstico concluído
        </p>
      </div>

      <p className="text-sm text-muted-foreground">O teu perfil</p>
      <h1 className="mt-2 font-display text-5xl leading-[1.02] tracking-tight md:text-7xl">
        <span
          className="inline-block bg-clip-text text-transparent"
          style={{
            backgroundImage:
              "linear-gradient(180deg, var(--gold-soft), var(--gold-deep))",
          }}
        >
          {profile.name}
        </span>
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
        {profile.line}
      </p>

      {/* Plano recomendado */}
      <div className="mt-12 rounded-3xl border border-primary/40 bg-primary/[0.06] p-7 md:p-9">
        <p className="text-sm text-muted-foreground">
          Com base nas tuas respostas, acreditamos que este é o plano ideal para ti.
        </p>
        <h2 className="mt-3 font-display text-3xl md:text-4xl">
          {profile.plan.name}
        </h2>
        <p className="mt-2 text-sm text-foreground/90">{profile.plan.tagline}</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {profile.plan.description}
        </p>
        <p className="mt-5 font-display text-xl text-foreground">
          {profile.plan.price}
        </p>
      </div>

      {/* Compatibilidade */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {(["start", "plus", "elite"] as const).map((k) => {
          const active = winner === k;
          return (
            <div
              key={k}
              className={cn(
                "rounded-2xl border p-5 transition",
                active ? "border-primary bg-primary/8" : "border-border bg-surface-1",
              )}
            >
              <div className="flex items-center justify-between">
                <p
                  className={cn(
                    "font-display text-base",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {profiles[k].plan.name}
                </p>
                {active && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary-foreground">
                    Match
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {profiles[k].plan.price}
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round((total[k] / max) * 100)}%` }}
                  transition={{ duration: 1, ease: easing }}
                  className="h-full rounded-full"
                  style={{
                    background: active
                      ? "linear-gradient(90deg, var(--gold-soft), var(--gold-deep))"
                      : "var(--muted-foreground)",
                    opacity: active ? 1 : 0.35,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Prova social antes do CTA */}
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {testimonials.map((t) => (
          <div
            key={t.name}
            className="rounded-2xl border border-border bg-surface-1 p-5"
          >
            <Quote className="h-4 w-4 text-primary" />
            <p className="mt-3 text-sm leading-relaxed text-foreground/90">
              “{t.quote}”
            </p>
            <div className="mt-4 flex items-center gap-3">
              <img
                src={t.avatar}
                alt=""
                aria-hidden
                loading="lazy"
                className="h-8 w-8 rounded-full object-cover"
              />
              <div>
                <p className="text-xs font-medium text-foreground">{t.name}</p>
                <p className="text-[11px] text-muted-foreground">{t.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onGo}
          className="group inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-sm font-semibold text-primary-foreground shadow-[0_20px_60px_-20px_oklch(0.82_0.13_82_/_0.7)] transition hover:bg-gold-soft"
        >
          Entrar no MM Club
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-4 text-sm font-medium transition hover:bg-surface-1"
        >
          Refazer diagnóstico
        </button>
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Cancelas quando quiseres.
        </span>
      </div>
    </div>
  );
}
