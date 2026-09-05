import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Lock,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";
import {
  checkQuizAnswer,
  getModuleQuiz,
  submitModuleQuiz,
  type MemberQuestion,
  type QuizModuleState,
  type QuizResultItem,
} from "@/lib/quiz.functions";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { setQuizModalOpen } from "@/lib/quiz-visibility";
import { cn } from "@/lib/utils";

type Props = {
  courseId: string;
  moduleId: string;
  moduleTitle: string;
  state: QuizModuleState | undefined;
  moduleLessonsCompleted: boolean;
  /** Aulas do módulo ainda não concluídas (bloqueiam o teste). */
  pendingLessons?: Array<{ id: string; title: string }>;
  onPassed: () => void;
  /** Abre e arranca o teste automaticamente (vindo do fim da última aula). */
  autoOpen?: boolean;
};

type Phase = "idle" | "loading" | "running" | "result";

type Feedback = {
  correct: boolean;
  correctIndex: number;
  explanation: string | null;
  lessonId: string | null;
  lessonTitle: string | null;
  startSeconds: number | null;
};

/** Pequena explosão de confetti para respostas certas e aprovação. */
function Confetti({ tone = "gold" }: { tone?: "gold" | "green" }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => ({
        i,
        cx: `${Math.round((Math.random() - 0.5) * 220)}px`,
        cy: `${Math.round(-60 - Math.random() * 140)}px`,
        delay: `${Math.round(Math.random() * 140)}ms`,
        size: 5 + Math.round(Math.random() * 5),
      })),
    [],
  );
  return (
    <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-10">
      {pieces.map((p) => (
        <span
          key={p.i}
          className={cn(
            "quiz-confetti-piece absolute block rounded-[2px]",
            tone === "green" ? "bg-emerald-400" : "bg-primary",
            p.i % 3 === 0 && "bg-gold-soft",
          )}
          style={
            {
              width: p.size,
              height: p.size,
              animationDelay: p.delay,
              ["--cx" as string]: p.cx,
              ["--cy" as string]: p.cy,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

/**
 * Teste de fim de módulo: perguntas de escolha múltipla geradas a partir das
 * transcrições. Corre num modal centrado, com feedback animado por resposta.
 * Aprovar desbloqueia o módulo seguinte.
 */
export function ModuleQuiz({
  courseId,
  moduleId,
  moduleTitle,
  state,
  moduleLessonsCompleted,
  pendingLessons = [],
  onPassed,
  autoOpen,
}: Props) {
  const load = useServerFn(getModuleQuiz);
  const submit = useServerFn(submitModuleQuiz);
  const check = useServerFn(checkQuizAnswer);

  const [phase, setPhase] = useState<Phase>("idle");
  const quizModalOpen = phase !== "idle";
  useEffect(() => {
    setQuizModalOpen(quizModalOpen);
    return () => setQuizModalOpen(false);
  }, [quizModalOpen]);
  const [questions, setQuestions] = useState<MemberQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [checking, setChecking] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    passScore: number;
    correct: number;
    total: number;
    results: QuizResultItem[];
  } | null>(null);

  const available = Boolean(state?.published && (state?.questionsAvailable ?? 0) > 0);
  const passed = Boolean(state?.passed);
  const open = phase !== "idle";

  // O teste só abre depois de todas as aulas do módulo estarem concluídas.
  const blockedMessage = useMemo(() => {
    if (moduleLessonsCompleted) return null;
    const names = pendingLessons.map((l) => `“${l.title}”`);
    if (names.length === 0) return "Vê todas as aulas deste módulo antes de fazer o teste.";
    if (names.length === 1) return `Termina a aula ${names[0]} para fazer o teste.`;
    const shown = names.slice(0, 3).join(", ");
    const extra = names.length > 3 ? ` e mais ${names.length - 3}` : "";
    return `Vê primeiro as aulas que faltam: ${shown}${extra}.`;
  }, [moduleLessonsCompleted, pendingLessons]);

  const start = useCallback(async () => {
    if (blockedMessage) {
      setError(blockedMessage);
      setPhase("idle");
      return;
    }
    setPhase("loading");
    setError(null);
    try {

      const res = await load({ data: { courseId, moduleId } });
      if (!res.questions.length) throw new Error("Este teste ainda não tem perguntas.");
      setQuestions(res.questions);
      setAnswers({});
      setFeedback({});
      setStep(0);
      setResult(null);
      setPhase("running");
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível abrir o teste.");
      setPhase("idle");
    }
  }, [blockedMessage, courseId, moduleId, load]);

  const current = questions[step];
  const currentFeedback = current ? feedback[current.id] : undefined;

  const answer = useCallback(
    async (choice: number) => {
      if (!current || feedback[current.id] || checking) return;
      setAnswers((a) => ({ ...a, [current.id]: choice }));
      setChecking(true);
      try {
        const fb = await check({ data: { questionId: current.id, choice } });
        setFeedback((f) => ({ ...f, [current.id]: fb }));
      } catch {
        // sem feedback imediato: a correção final continua a ser feita no servidor
        setFeedback((f) => ({
          ...f,
          [current.id]: {
            correct: false,
            correctIndex: -1,
            explanation: null,
            lessonId: null,
            lessonTitle: null,
            startSeconds: null,
          },
        }));
      } finally {
        setChecking(false);
      }
    },
    [check, checking, current, feedback],
  );

  const finish = useCallback(async () => {
    setPhase("loading");
    try {
      const payload = questions.map((q) => ({
        questionId: q.id,
        choice: answers[q.id] ?? null,
      }));
      const res = await submit({ data: { courseId, moduleId, answers: payload } });
      setResult(res);
      setPhase("result");
      if (res.passed) onPassed();
    } catch (e: any) {
      setError(e?.message ?? "Falhou o envio do teste.");
      setPhase("running");
    }
  }, [answers, courseId, moduleId, onPassed, questions, submit]);

  const answeredAll = useMemo(
    () => questions.length > 0 && questions.every((q) => answers[q.id] !== undefined),
    [answers, questions],
  );
  const correctSoFar = useMemo(
    () => Object.values(feedback).filter((f) => f.correct).length,
    [feedback],
  );

  // Vindo do fim da última aula do módulo: abre o teste sozinho.
  const autoRef = useRef(false);
  useEffect(() => {
    if (!autoOpen || autoRef.current || !available || passed || blockedMessage) return;
    autoRef.current = true;
    void start();
  }, [autoOpen, available, blockedMessage, passed, start]);

  if (!available && !passed) return null;

  const blocked = !passed && Boolean(blockedMessage);

  return (
    <>
      {/* Cartão de entrada, no fim da lista de aulas do módulo */}
      <div className="relative overflow-hidden border-t border-border bg-gradient-to-r from-primary/10 via-surface-2/60 to-surface-2/30 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1",
                passed
                  ? "bg-emerald-500/15 text-emerald-500 ring-emerald-500/30"
                  : blocked
                    ? "bg-surface-3 text-muted-foreground ring-border"
                    : "bg-primary/15 text-primary ring-primary/30",
              )}
            >
              {passed ? (
                <Trophy className="h-5 w-5" />
              ) : blocked ? (
                <Lock className="h-5 w-5" />
              ) : (
                <BrainCircuit className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {passed ? "Teste do módulo aprovado" : "Teste do módulo"}
              </p>
              <p className="text-xs text-muted-foreground">
                {passed
                  ? `Melhor nota: ${state?.bestScore ?? 100}%. Podes repetir para revisar.`
                  : blocked
                    ? blockedMessage
                    : `${state?.questionCount ?? 5} perguntas · mínimo ${state?.passScore ?? 80}% para desbloquear o módulo seguinte`}
              </p>
              {blocked && pendingLessons.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {pendingLessons.slice(0, 4).map((l) => (
                    <li key={l.id}>
                      <Link
                        to="/academia/$courseId/$lessonId"
                        params={{ courseId, lessonId: l.id }}
                        className="inline-flex max-w-[240px] items-center gap-1 truncate rounded-full border border-border bg-surface-1 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                      >
                        <ChevronRight className="h-3 w-3 shrink-0 text-primary" />
                        <span className="truncate">{l.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {!blocked && error && phase === "idle" && (
                <p className="mt-1 text-xs text-red-500">{error}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={start}
            disabled={blocked}
            aria-disabled={blocked}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition",
              blocked
                ? "cursor-not-allowed border border-border bg-surface-2 text-muted-foreground"
                : "hover:scale-[1.02]",
              !blocked &&
                (passed
                  ? "border border-border bg-surface-1 text-foreground hover:bg-surface-3"
                  : "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-gold-soft"),
            )}
          >
            {blocked ? (
              <Lock className="h-3.5 w-3.5" />
            ) : passed ? (
              <RotateCcw className="h-3.5 w-3.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {blocked ? "Teste bloqueado" : passed ? "Repetir teste" : "Começar teste"}
          </button>
        </div>
      </div>


      {/* Modal do teste — centrado, por cima de tudo */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) setPhase("idle");
        }}
      >
        <DialogContent
          className="max-h-[88vh] overflow-y-auto border-border bg-surface-1 p-0 sm:max-w-lg"
        >
          <div className="border-b border-border bg-surface-2/60 px-5 py-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
              Teste do módulo
            </p>
            <h3 className="mt-1 truncate pr-8 font-display text-base text-foreground">
              {moduleTitle}
            </h3>
          </div>

          <div className="px-5 py-5">
            {phase === "loading" && (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> A preparar…
              </div>
            )}

            {phase === "running" && current && (
              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Pergunta {step + 1} de {questions.length}
                    </span>
                    <span className="text-primary">
                      {correctSoFar} certas · mínimo {state?.passScore ?? 80}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${((step + 1) / questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                <div key={current.id} className="quiz-question space-y-4">
                  <p className="text-[15px] font-medium leading-snug text-foreground">
                    {current.prompt}
                  </p>
                  <div className="grid gap-2">
                    {current.options.map((opt, i) => {
                      const selected = answers[current.id] === i;
                      const fb = currentFeedback;
                      const isCorrectOption = fb ? fb.correctIndex === i : false;
                      const wrongPick = Boolean(fb && selected && !fb.correct);
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={Boolean(fb) || checking}
                          onClick={() => void answer(i)}
                          className={cn(
                            "relative flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-left text-sm transition",
                            !fb &&
                              (selected
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border bg-surface-2 text-muted-foreground hover:border-primary/40 hover:bg-surface-3 hover:text-foreground"),
                            fb && isCorrectOption &&
                              "border-emerald-500/60 bg-emerald-500/10 text-foreground",
                            wrongPick && "border-red-500/60 bg-red-500/10 text-foreground",
                            fb && !isCorrectOption && !wrongPick && "border-border bg-surface-2 text-muted-foreground opacity-60",
                            fb && isCorrectOption && "quiz-right",
                            wrongPick && "quiz-wrong",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-px text-xs font-semibold",
                              fb && isCorrectOption
                                ? "text-emerald-500"
                                : wrongPick
                                  ? "text-red-500"
                                  : "text-primary",
                            )}
                          >
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="min-w-0 flex-1">{opt}</span>
                          {fb && isCorrectOption && (
                            <CheckCircle2 className="quiz-badge mt-px h-4 w-4 shrink-0 text-emerald-500" />
                          )}
                          {wrongPick && (
                            <XCircle className="quiz-badge mt-px h-4 w-4 shrink-0 text-red-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {checking && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> A verificar…
                    </p>
                  )}

                  {currentFeedback && (
                    <div
                      className={cn(
                        "quiz-question relative overflow-hidden rounded-xl px-3.5 py-3 text-xs ring-1",
                        currentFeedback.correct
                          ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/25"
                          : "bg-red-500/10 text-red-400 ring-red-500/25",
                      )}
                    >
                      {currentFeedback.correct && <Confetti tone="green" />}
                      <p className="font-semibold">
                        {currentFeedback.correct ? "Certo!" : "Não é essa."}
                      </p>
                      {!currentFeedback.correct && currentFeedback.correctIndex >= 0 && (
                        <p className="mt-1 text-foreground/80">
                          Resposta correta:{" "}
                          <span className="font-semibold text-emerald-500">
                            {current.options[currentFeedback.correctIndex]}
                          </span>
                        </p>
                      )}
                      {currentFeedback.explanation && (
                        <p className="mt-1 text-foreground/80">{currentFeedback.explanation}</p>
                      )}
                      {currentFeedback.lessonId && (
                        <Link
                          to="/academia/$courseId/$lessonId"
                          params={{ courseId, lessonId: currentFeedback.lessonId }}
                          search={
                            currentFeedback.startSeconds
                              ? ({ t: Math.floor(currentFeedback.startSeconds) } as never)
                              : undefined
                          }
                          className="mt-1.5 inline-flex text-primary transition hover:underline"
                        >
                          Rever: {currentFeedback.lessonTitle ?? "aula"}
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                {error && <p className="text-xs text-red-500">{error}</p>}

                <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => (step === 0 ? setPhase("idle") : setStep((s) => s - 1))}
                    className="text-xs text-muted-foreground transition hover:text-foreground"
                  >
                    {step === 0 ? "Sair" : "Anterior"}
                  </button>
                  {step < questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setStep((s) => s + 1)}
                      disabled={!currentFeedback}
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-gold-soft disabled:opacity-40"
                    >
                      Seguinte <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={finish}
                      disabled={!answeredAll}
                      className="rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-gold-soft disabled:opacity-40"
                    >
                      Ver resultado
                    </button>
                  )}
                </div>
              </div>
            )}

            {phase === "result" && result && (
              <div className="space-y-4">
                <div
                  className={cn(
                    "quiz-question relative overflow-hidden rounded-2xl px-4 py-5 text-center ring-1",
                    result.passed
                      ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/25"
                      : "bg-amber-500/10 text-amber-500 ring-amber-500/25",
                  )}
                >
                  {result.passed && <Confetti />}
                  <span className="quiz-badge mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-current/15">
                    {result.passed ? (
                      <Trophy className="h-6 w-6" />
                    ) : (
                      <RotateCcw className="h-6 w-6" />
                    )}
                  </span>
                  <p className="mt-3 font-display text-2xl">{result.score}%</p>
                  <p className="text-sm font-semibold">
                    {result.passed ? "Aprovado" : `Precisas de ${result.passScore}%`}
                  </p>
                  <p className="mt-1 text-xs opacity-80">
                    {result.correct} de {result.total} corretas.{" "}
                    {result.passed
                      ? "Módulo seguinte desbloqueado."
                      : "Revê as explicações abaixo e tenta outra vez."}
                  </p>
                </div>

                <ul className="space-y-2">
                  {result.results.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-xl border border-border bg-surface-2 px-3 py-3 text-xs"
                    >
                      <div className="flex items-start gap-2">
                        {r.correct ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        ) : (
                          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                        )}
                        <div className="min-w-0 space-y-1">
                          <p className="text-foreground">{r.prompt}</p>
                          {!r.correct && (
                            <p className="text-muted-foreground">
                              Resposta certa:{" "}
                              <span className="text-foreground">{r.options[r.correctIndex]}</span>
                            </p>
                          )}
                          {r.explanation && (
                            <p className="text-muted-foreground">{r.explanation}</p>
                          )}
                          {r.lessonId && (
                            <Link
                              to="/academia/$courseId/$lessonId"
                              params={{ courseId, lessonId: r.lessonId }}
                              search={
                                r.startSeconds
                                  ? ({ t: Math.floor(r.startSeconds) } as never)
                                  : undefined
                              }
                              className="inline-flex text-primary transition hover:underline"
                            >
                              Rever: {r.lessonTitle ?? "aula"}
                            </Link>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="flex items-center gap-3 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={start}
                    className="rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-gold-soft"
                  >
                    {result.passed ? "Repetir" : "Tentar de novo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhase("idle")}
                    className="text-xs text-muted-foreground transition hover:text-foreground"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
