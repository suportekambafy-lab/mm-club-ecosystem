import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Check,
  Rocket,
  Target,
  Clock,
  TrendingUp,
  Brain,
  Wallet,
  Compass,
} from "lucide-react";
import { MMLogo } from "@/components/mm/logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/quiz")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Diagnóstico MM Club — Descobre o teu plano ideal" },
      {
        name: "description",
        content:
          "Um diagnóstico premium de 7 passos que cruza a tua fase de negócio, ambição e estilo — e recomenda o plano MM Club certo para ti.",
      },
    ],
  }),
  component: QuizPage,
});

/* ---------------- Quiz definition ---------------- */

type Choice = {
  id: string;
  label: string;
  hint?: string;
  weight: { start: number; plus: number; elite: number };
};

type Step = {
  key: string;
  icon: typeof Rocket;
  kicker: string;
  title: string;
  description: string;
  choices: Choice[];
};

const steps: Step[] = [
  {
    key: "stage",
    icon: Rocket,
    kicker: "01 · Ponto de partida",
    title: "Em que fase está o teu negócio?",
    description: "Precisamos de saber onde estás antes de te mostrar o caminho.",
    choices: [
      { id: "idea", label: "Ainda é uma ideia", hint: "Quero validar e lançar", weight: { start: 3, plus: 1, elite: 0 } },
      { id: "launch", label: "Acabei de lançar", hint: "Primeiros meses", weight: { start: 2, plus: 2, elite: 0 } },
      { id: "clients", label: "Já tenho clientes", hint: "Faturação irregular", weight: { start: 1, plus: 3, elite: 1 } },
      { id: "scaling", label: "A escalar", hint: "Já facturo consistente", weight: { start: 0, plus: 2, elite: 3 } },
      { id: "consolidate", label: "A consolidar equipa e marca", hint: "Foco em legado", weight: { start: 0, plus: 1, elite: 3 } },
    ],
  },
  {
    key: "revenue",
    icon: TrendingUp,
    kicker: "02 · Faturação atual",
    title: "Quanto facturas por mês, em média?",
    description: "Sem juízo — só serve para calibrar a recomendação.",
    choices: [
      { id: "0", label: "0 € — ainda não facturei", weight: { start: 3, plus: 1, elite: 0 } },
      { id: "1k", label: "Até 1.000 €", weight: { start: 3, plus: 1, elite: 0 } },
      { id: "5k", label: "1.000 € – 5.000 €", weight: { start: 1, plus: 3, elite: 0 } },
      { id: "10k", label: "5.000 € – 10.000 €", weight: { start: 0, plus: 3, elite: 2 } },
      { id: "10kplus", label: "Mais de 10.000 €", weight: { start: 0, plus: 1, elite: 3 } },
    ],
  },
  {
    key: "time",
    icon: Clock,
    kicker: "03 · Tempo disponível",
    title: "Quanto tempo por semana consegues dedicar?",
    description: "Realismo agora poupa frustração depois.",
    choices: [
      { id: "lt5", label: "Menos de 5h", hint: "Estou muito ocupado", weight: { start: 2, plus: 2, elite: 1 } },
      { id: "5_10", label: "5h – 10h", weight: { start: 2, plus: 3, elite: 1 } },
      { id: "10_20", label: "10h – 20h", weight: { start: 1, plus: 3, elite: 2 } },
      { id: "20plus", label: "Mais de 20h", hint: "Full-time nisto", weight: { start: 0, plus: 2, elite: 3 } },
    ],
  },
  {
    key: "block",
    icon: Brain,
    kicker: "04 · Maior bloqueio",
    title: "Qual é o teu maior bloqueio agora?",
    description: "Escolhe o que mais te tira o sono.",
    choices: [
      { id: "clarity", label: "Falta de clareza", hint: "Não sei por onde começar", weight: { start: 3, plus: 1, elite: 0 } },
      { id: "sales", label: "Vender e atrair clientes", weight: { start: 1, plus: 3, elite: 1 } },
      { id: "delivery", label: "Escalar sem colapsar", weight: { start: 0, plus: 2, elite: 3 } },
      { id: "brand", label: "Posicionamento e marca", weight: { start: 1, plus: 2, elite: 2 } },
      { id: "money", label: "Controlo financeiro", weight: { start: 1, plus: 2, elite: 2 } },
    ],
  },
  {
    key: "goal",
    icon: Target,
    kicker: "05 · Ambição · 12 meses",
    title: "Onde queres estar daqui a um ano?",
    description: "O objectivo dita o ritmo — e o plano.",
    choices: [
      { id: "1k", label: "Facturar os primeiros 1.000 € / mês", weight: { start: 3, plus: 1, elite: 0 } },
      { id: "5k", label: "Facturar 5.000 € / mês", weight: { start: 2, plus: 3, elite: 0 } },
      { id: "10k", label: "Facturar 10.000 € / mês", weight: { start: 0, plus: 3, elite: 2 } },
      { id: "30k", label: "30.000 € / mês ou mais", weight: { start: 0, plus: 1, elite: 3 } },
      { id: "legacy", label: "Construir marca de longo prazo", weight: { start: 0, plus: 2, elite: 3 } },
    ],
  },
  {
    key: "style",
    icon: Compass,
    kicker: "06 · Estilo de aprendizagem",
    title: "Como aprendes melhor?",
    description: "Alinhamos o teu percurso ao que te faz avançar.",
    choices: [
      { id: "self", label: "Sozinho, ao meu ritmo", weight: { start: 3, plus: 2, elite: 1 } },
      { id: "live", label: "Em lives e ao vivo com especialistas", weight: { start: 1, plus: 3, elite: 2 } },
      { id: "community", label: "Com comunidade e feedback", weight: { start: 2, plus: 3, elite: 2 } },
      { id: "1to1", label: "Acompanhamento próximo", hint: "Quero mentoria", weight: { start: 0, plus: 1, elite: 3 } },
    ],
  },
  {
    key: "commitment",
    icon: Wallet,
    kicker: "07 · Compromisso",
    title: "Quanto estás disposto a investir por mês?",
    description: "O investimento certo é o que te obriga a jogar a sério.",
    choices: [
      { id: "u30", label: "Até 30 € / mês", weight: { start: 3, plus: 1, elite: 0 } },
      { id: "u60", label: "Até 60 € / mês", weight: { start: 1, plus: 3, elite: 1 } },
      { id: "u100", label: "Até 100 € / mês", weight: { start: 0, plus: 2, elite: 3 } },
      { id: "unlimited", label: "O que for preciso", weight: { start: 0, plus: 1, elite: 3 } },
    ],
  },
];

const planCopy = {
  start: {
    id: "start",
    name: "MM Club Start",
    tagline: "Base sólida para começar hoje.",
    description:
      "Ideal para quem ainda está a construir clareza e as primeiras receitas. Acesso completo, ritmo próprio.",
    price: "29,90 € / mês",
  },
  plus: {
    id: "plus",
    name: "MM Club Plus",
    tagline: "O ritmo certo para escalar.",
    description:
      "Para quem já tem sinais de mercado e quer acelerar com lives, comunidade e método. Mais popular.",
    price: "149,90 € / 6 meses",
  },
  elite: {
    id: "elite",
    name: "MM Club Elite",
    tagline: "Ambição sem tecto.",
    description:
      "Para quem opera com padrão executivo — acesso completo, ano inteiro, sem interrupções.",
    price: "249,90 € / ano",
  },
} as const;

function computeResult(answers: Record<string, Choice>) {
  const total = { start: 0, plus: 0, elite: 0 };
  for (const c of Object.values(answers)) {
    total.start += c.weight.start;
    total.plus += c.weight.plus;
    total.elite += c.weight.elite;
  }
  const winner = (Object.entries(total).sort((a, b) => b[1] - a[1])[0][0] ??
    "plus") as "start" | "plus" | "elite";
  return { winner, total };
}

/* ---------------- Component ---------------- */

function QuizPage() {
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Choice>>({});
  const [done, setDone] = useState(false);

  const step = steps[i];
  const StepIcon = step?.icon ?? Sparkles;
  const progress = done ? 1 : (i + (answers[step.key] ? 1 : 0)) / steps.length;

  const result = useMemo(() => (done ? computeResult(answers) : null), [done, answers]);
  const chosen = result ? planCopy[result.winner] : null;

  function selectChoice(c: Choice) {
    const next = { ...answers, [step.key]: c };
    setAnswers(next);
    setTimeout(() => {
      if (i < steps.length - 1) setI(i + 1);
      else setDone(true);
    }, 220);
  }

  function goBack() {
    if (done) {
      setDone(false);
      return;
    }
    if (i > 0) setI(i - 1);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Ambient atmosphere — matches landing */}
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

      {/* Header */}
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

      {/* Progress bar */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          <span>
            {done ? "Concluído" : `Passo ${i + 1} de ${steps.length}`}
          </span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
        <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-surface-2">
          <motion.div
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="h-full rounded-full"
            style={{
              background:
                "linear-gradient(90deg, oklch(0.82 0.13 82), oklch(0.58 0.14 68))",
            }}
          />
        </div>
      </div>

      {/* Body */}
      <main className="mx-auto max-w-5xl px-6 py-12 md:py-16">
        <AnimatePresence mode="wait">
          {!done ? (
            <motion.section
              key={step.key}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-hairline bg-surface-1 text-primary">
                  <StepIcon className="h-5 w-5" />
                </div>
                <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-primary">
                  {step.kicker}
                </p>
              </div>
              <h1 className="font-display text-4xl leading-[1.02] tracking-tight text-foreground md:text-6xl">
                {step.title}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                {step.description}
              </p>

              <div className="mt-10 grid gap-3 md:grid-cols-2">
                {step.choices.map((c, idx) => {
                  const selected = answers[step.key]?.id === c.id;
                  return (
                    <motion.button
                      key={c.id}
                      type="button"
                      onClick={() => selectChoice(c)}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.4,
                        delay: idx * 0.05,
                        ease: [0.22, 1, 0.36, 1],
                      }}
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
                          <p className="mt-1 text-xs text-muted-foreground">
                            {c.hint}
                          </p>
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

              <div className="mt-10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={i === 0}
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Anterior
                </button>
                <p className="text-xs text-muted-foreground">
                  Escolhe uma opção para avançar
                </p>
              </div>
            </motion.section>
          ) : (
            <motion.section
              key="result"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_30px_-8px_oklch(0.82_0.13_82_/_0.7)]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-primary">
                  Diagnóstico concluído
                </p>
              </div>

              <h1 className="font-display text-4xl leading-[1.02] tracking-tight md:text-6xl">
                O teu plano recomendado é{" "}
                <span
                  className="inline-block bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(180deg, var(--gold-soft), var(--gold-deep))",
                  }}
                >
                  {chosen?.name}
                </span>
                .
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
                {chosen?.tagline} {chosen?.description}
              </p>

              {/* Score bars */}
              <div className="mt-10 grid gap-4 md:grid-cols-3">
                {(["start", "plus", "elite"] as const).map((k) => {
                  const total =
                    (result?.total[k] ?? 0) /
                    Math.max(
                      1,
                      Math.max(
                        result?.total.start ?? 0,
                        result?.total.plus ?? 0,
                        result?.total.elite ?? 0,
                      ),
                    );
                  const active = result?.winner === k;
                  return (
                    <div
                      key={k}
                      className={cn(
                        "rounded-2xl border p-5 transition",
                        active
                          ? "border-primary bg-primary/8"
                          : "border-border bg-surface-1",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <p
                          className={cn(
                            "font-display text-base",
                            active ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {planCopy[k].name}
                        </p>
                        {active && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary-foreground">
                            Match
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {planCopy[k].price}
                      </p>
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.round(total * 100)}%` }}
                          transition={{
                            duration: 1,
                            ease: [0.22, 1, 0.36, 1],
                          }}
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

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: "/checkout",
                      search: { plan: result?.winner ?? "plus" },
                    })
                  }
                  className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground shadow-[0_20px_60px_-20px_oklch(0.82_0.13_82_/_0.7)] transition hover:bg-gold-soft"
                >
                  Ver {chosen?.name}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAnswers({});
                    setI(0);
                    setDone(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-4 text-sm font-medium transition hover:bg-surface-1"
                >
                  Refazer diagnóstico
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
