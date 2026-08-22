import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BrainCircuit,
  CheckCircle2,
  Loader2,
  Lock,
  RotateCcw,
  Trophy,
  XCircle,
} from "lucide-react";
import {
  getModuleQuiz,
  submitModuleQuiz,
  type MemberQuestion,
  type QuizModuleState,
  type QuizResultItem,
} from "@/lib/quiz.functions";
import { cn } from "@/lib/utils";

type Props = {
  courseId: string;
  moduleId: string;
  moduleTitle: string;
  state: QuizModuleState | undefined;
  moduleLessonsCompleted: boolean;
  onPassed: () => void;
  /** Abre e arranca o teste automaticamente (vindo do fim da última aula). */
  autoOpen?: boolean;
};

type Phase = "idle" | "loading" | "running" | "result";

/**
 * Teste de fim de módulo: 5 perguntas de escolha múltipla geradas a partir das
 * transcrições das aulas. Aprovar desbloqueia o módulo seguinte.
 */
export function ModuleQuiz({
  courseId,
  moduleId,
  moduleTitle,
  state,
  moduleLessonsCompleted,
  onPassed,
}: Props) {
  const load = useServerFn(getModuleQuiz);
  const submit = useServerFn(submitModuleQuiz);

  const [phase, setPhase] = useState<Phase>("idle");
  const [questions, setQuestions] = useState<MemberQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
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

  const start = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const res = await load({ data: { courseId, moduleId } });
      if (!res.questions.length) throw new Error("Este teste ainda não tem perguntas.");
      setQuestions(res.questions);
      setAnswers({});
      setStep(0);
      setResult(null);
      setPhase("running");
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível abrir o teste.");
      setPhase("idle");
    }
  }, [courseId, moduleId, load]);

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

  const current = questions[step];
  const answeredAll = useMemo(
    () => questions.length > 0 && questions.every((q) => answers[q.id] !== undefined),
    [answers, questions],
  );

  if (!available && !passed) return null;

  return (
    <div className="border-t border-border bg-surface-2/50 px-4 py-4 sm:px-5">
      {phase === "idle" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                passed ? "bg-emerald-500/15 text-emerald-500" : "bg-primary/15 text-primary",
              )}
            >
              {passed ? <Trophy className="h-4 w-4" /> : <BrainCircuit className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {passed ? "Teste do módulo aprovado" : "Teste do módulo"}
              </p>
              <p className="text-xs text-muted-foreground">
                {passed
                  ? `Melhor nota: ${state?.bestScore ?? 100}%. Podes repetir para revisar.`
                  : moduleLessonsCompleted
                    ? `${state?.questionCount ?? 5} perguntas · mínimo ${state?.passScore ?? 80}% para desbloquear o módulo seguinte`
                    : "Conclui as aulas deste módulo para fazer o teste"}
              </p>
              {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={start}
            disabled={!moduleLessonsCompleted && !passed}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
              passed
                ? "border border-border bg-surface-1 text-foreground hover:bg-surface-3"
                : "bg-primary text-primary-foreground hover:bg-gold-soft",
            )}
          >
            {!moduleLessonsCompleted && !passed ? (
              <Lock className="h-3.5 w-3.5" />
            ) : (
              <BrainCircuit className="h-3.5 w-3.5" />
            )}
            {passed ? "Repetir teste" : "Começar teste"}
          </button>
        </div>
      )}

      {phase === "loading" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> A preparar…
        </div>
      )}

      {phase === "running" && current && (
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Pergunta {step + 1} de {questions.length} · {moduleTitle}
              </span>
              <span className="text-primary">
                mínimo {state?.passScore ?? 80}%
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${((step + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          <p className="text-sm font-medium text-foreground">{current.prompt}</p>
          <div className="grid gap-2">
            {current.options.map((opt, i) => {
              const selected = answers[current.id] === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAnswers((a) => ({ ...a, [current.id]: i }))}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-sm transition",
                    selected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-surface-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground",
                  )}
                >
                  <span className="mr-2 text-xs font-semibold text-primary">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => (step === 0 ? setPhase("idle") : setStep((s) => s - 1))}
              className="text-xs text-muted-foreground transition hover:text-foreground"
            >
              {step === 0 ? "Cancelar" : "Anterior"}
            </button>
            {step < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={answers[current.id] === undefined}
                className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-gold-soft disabled:opacity-50"
              >
                Seguinte
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                disabled={!answeredAll}
                className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-gold-soft disabled:opacity-50"
              >
                Entregar teste
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "result" && result && (
        <div className="space-y-4">
          <div
            className={cn(
              "flex items-start gap-3 rounded-xl px-4 py-3",
              result.passed
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-amber-500/10 text-amber-500",
            )}
          >
            {result.passed ? (
              <Trophy className="mt-0.5 h-5 w-5" />
            ) : (
              <RotateCcw className="mt-0.5 h-5 w-5" />
            )}
            <div>
              <p className="text-sm font-semibold">
                {result.passed
                  ? `Aprovado com ${result.score}%`
                  : `${result.score}% — precisas de ${result.passScore}%`}
              </p>
              <p className="text-xs opacity-80">
                {result.correct} de {result.total} corretas.{" "}
                {result.passed
                  ? "Módulo seguinte desbloqueado."
                  : "Revê as explicações abaixo e tenta outra vez."}
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {result.results.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-border bg-surface-1 px-3 py-3 text-xs"
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
                    {r.explanation && <p className="text-muted-foreground">{r.explanation}</p>}
                    {r.lessonId && (
                      <Link
                        to="/academia/$courseId/$lessonId"
                        params={{ courseId, lessonId: r.lessonId }}
                        search={r.startSeconds ? ({ t: Math.floor(r.startSeconds) } as never) : undefined}
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

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={start}
              className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-gold-soft"
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
  );
}
