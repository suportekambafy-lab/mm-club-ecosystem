import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BrainCircuit,
  Check,
  Loader2,
  Pencil,
  RefreshCw,
  Shuffle,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { SectionHeading } from "@/components/mm/section-heading";
import { courses } from "@/data/courses";
import { applyOverrides, loadOverrides } from "@/data/admin-store";
import type { Course, Module } from "@/data/types";
import {
  deleteQuestion,
  generateModuleQuiz,
  getQuizAnalytics,
  listModuleQuestions,
  saveModuleSettings,
  shuffleModuleOptions,
  updateQuestion,
} from "@/lib/quiz.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/quizzes")({
  component: AdminQuizzes,
});

type QuestionRow = Awaited<ReturnType<typeof listModuleQuestions>>[number];
type Analytics = Awaited<ReturnType<typeof getQuizAnalytics>>;

function AdminQuizzes() {
  const [ready, setReady] = useState(false);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [analytics, setAnalytics] = useState<Analytics>([]);

  const loadAnalytics = useServerFn(getQuizAnalytics);

  useEffect(() => {
    (async () => {
      try {
        applyOverrides(await loadOverrides());
      } catch {
        /* usa dados locais */
      }
      setReady(true);
    })();
  }, []);

  const refreshAnalytics = useCallback(async () => {
    if (!courseId) return;
    try {
      setAnalytics(await loadAnalytics({ data: { courseId } }));
    } catch {
      setAnalytics([]);
    }
  }, [courseId, loadAnalytics]);

  useEffect(() => {
    void refreshAnalytics();
  }, [refreshAnalytics]);

  const course: Course | undefined = courses.find((c) => c.id === courseId);

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Academia"
        title="MM Quiz"
        size="md"
        description="Testes de fim de módulo gerados a partir das transcrições. Aprovar desbloqueia o módulo seguinte."
      />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="rounded-full border border-border bg-surface-1 px-4 py-2 text-sm text-foreground"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void refreshAnalytics()}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-4 py-2 text-xs font-semibold transition hover:bg-surface-2"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar métricas
        </button>
        <button
          type="button"
          disabled={bulk.running || !course?.modules?.length}
          onClick={() => void generateMissing()}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {bulk.running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {bulk.running
            ? `A gerar ${bulk.done}/${bulk.total}…`
            : "Gerar testes em falta (curso)"}
        </button>
      </div>

      {ready && course?.modules?.length ? (
        <p className="text-xs text-muted-foreground">
          {missingModules.length === 0
            ? "Todos os módulos deste curso já têm perguntas."
            : `${missingModules.length} módulo(s) sem perguntas. A geração usa as transcrições das aulas; publica cada teste depois de rever.`}
        </p>
      ) : null}

      {!ready && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar cursos…
        </p>
      )}

      {ready && course?.modules?.length ? (
        <div className="space-y-4">
          {course.modules.map((m, i) => (
            <ModuleCard
              key={m.id}
              course={course}
              module={m}
              index={i}
              stats={analytics.find((a) => a.moduleId === m.id)}
              onChanged={refreshAnalytics}
            />
          ))}
        </div>
      ) : null}

      {ready && !course?.modules?.length && (
        <p className="text-sm text-muted-foreground">Este curso não tem módulos.</p>
      )}
    </div>
  );
}

function ModuleCard({
  course,
  module: m,
  index,
  stats,
  onChanged,
}: {
  course: Course;
  module: Module;
  index: number;
  stats: Analytics[number] | undefined;
  onChanged: () => void;
}) {
  const list = useServerFn(listModuleQuestions);
  const generate = useServerFn(generateModuleQuiz);
  const save = useServerFn(saveModuleSettings);
  const shuffleOptions = useServerFn(shuffleModuleOptions);

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState(stats?.published ?? false);
  const [passScore, setPassScore] = useState(stats?.passScore ?? 80);
  const [questionCount, setQuestionCount] = useState(stats?.questionCount ?? 5);

  useEffect(() => {
    setPublished(stats?.published ?? false);
    setPassScore(stats?.passScore ?? 80);
    setQuestionCount(stats?.questionCount ?? 5);
  }, [stats?.published, stats?.passScore, stats?.questionCount]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await list({ data: { courseId: course.id, moduleId: m.id } }));
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou a leitura das perguntas");
    } finally {
      setLoading(false);
    }
  }, [course.id, list, m.id]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  async function handleGenerate() {
    setBusy(true);
    try {
      const res = (await generate({
        data: {
          courseId: course.id,
          courseTitle: course.title,
          moduleId: m.id,
          moduleTitle: m.title,
          lessons: m.lessons.map((l) => ({ id: l.id, title: l.title })),
          count: Math.max(questionCount + 3, 8),
          replace: true,
        },
      })) as { created?: number };
      toast.success(`Geradas ${res?.created ?? 0} perguntas para “${m.title}”.`);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou a geração");
    } finally {
      setBusy(false);
    }
  }

  async function persistSettings(patch: {
    published?: boolean;
    passScore?: number;
    questionCount?: number;
  }) {
    try {
      await save({ data: { courseId: course.id, moduleId: m.id, ...patch } });
      toast.success("Definições guardadas.");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou a gravação");
    }
  }

  const activeCount = rows.filter((r) => r.active).length;

  return (
    <div className="overflow-hidden rounded-xl bg-surface-1 ring-1 ring-border">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
            Módulo {String(index + 1).padStart(2, "0")}
          </p>
          <h3 className="truncate font-display text-base text-foreground">{m.title}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{m.lessons.length} aulas</span>
            <span>{stats?.questionsAvailable ?? 0} perguntas</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                published
                  ? "bg-emerald-500/15 text-emerald-500"
                  : "bg-amber-500/15 text-amber-500",
              )}
            >
              {published ? "Visível aos membros" : "Rascunho"}
            </span>
            {stats && stats.attempts > 0 && (
              <>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> {stats.members} membros
                </span>
                <span>
                  {stats.attempts} tentativas · média {stats.avgScore}%
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy || (stats?.questionsAvailable ?? 0) === 0}
            onClick={async () => {
              const next = !published;
              setPublished(next);
              await persistSettings({ published: next });
            }}
            title={
              (stats?.questionsAvailable ?? 0) === 0
                ? "Gera perguntas antes de publicar"
                : undefined
            }
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition disabled:opacity-50",
              published
                ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                : "border border-border bg-surface-2 hover:bg-surface-3",
            )}
          >
            <Check className="h-3.5 w-3.5" /> {published ? "Publicado" : "Publicar teste"}
          </button>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-gold-soft disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Gerar por IA
          </button>
          <button
            type="button"
            onClick={async () => {
              setBusy(true);
              try {
                const res = (await shuffleOptions({
                  data: { courseId: course.id, moduleId: m.id },
                })) as { updated?: number };
                toast.success(`Opções misturadas em ${res?.updated ?? 0} perguntas.`);
                await refresh();
              } catch (e: any) {
                toast.error(e?.message ?? "Falhou a mistura");
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-4 py-2 text-xs font-semibold transition hover:bg-surface-3 disabled:opacity-50"
          >
            <Shuffle className="h-3.5 w-3.5" /> Misturar opções
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-4 py-2 text-xs font-semibold transition hover:bg-surface-3"
          >
            <BrainCircuit className="h-3.5 w-3.5" />
            {open ? "Fechar" : "Perguntas"}
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-4 border-t border-border px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => {
                  setPublished(e.target.checked);
                  void persistSettings({ published: e.target.checked });
                }}
                className="h-4 w-4 accent-[color:var(--color-primary,#c8a24a)]"
              />
              Publicado (bloqueia módulo seguinte)
            </label>
            <label className="flex items-center gap-2">
              Nota mínima
              <input
                type="number"
                min={20}
                max={100}
                value={passScore}
                onChange={(e) => setPassScore(Number(e.target.value))}
                onBlur={() => void persistSettings({ passScore })}
                className="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1"
              />
              %
            </label>
            <label className="flex items-center gap-2">
              Perguntas por teste
              <input
                type="number"
                min={1}
                max={20}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                onBlur={() => void persistSettings({ questionCount })}
                className="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1"
              />
            </label>
            <span className="text-muted-foreground">
              {activeCount} perguntas ativas no banco
            </span>
          </div>

          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
            </p>
          )}

          {!loading && !rows.length && (
            <p className="text-sm text-muted-foreground">
              Sem perguntas. Usa “Gerar por IA” — precisa das transcrições das aulas.
            </p>
          )}

          <ul className="space-y-2">
            {rows.map((r) => (
              <QuestionEditor key={r.id} row={r} onRefresh={refresh} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function QuestionEditor({ row, onRefresh }: { row: QuestionRow; onRefresh: () => void }) {
  const update = useServerFn(updateQuestion);
  const remove = useServerFn(deleteQuestion);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState(row.prompt);
  const [options, setOptions] = useState<string[]>(row.options);
  const [correctIndex, setCorrectIndex] = useState(row.correct_index);
  const [explanation, setExplanation] = useState(row.explanation ?? "");

  useEffect(() => {
    setPrompt(row.prompt);
    setOptions(row.options);
    setCorrectIndex(row.correct_index);
    setExplanation(row.explanation ?? "");
  }, [row]);

  async function handleSave() {
    const clean = options.map((o) => o.trim());
    if (!prompt.trim() || clean.some((o) => !o)) {
      toast.error("Preenche a pergunta e todas as opções.");
      return;
    }
    setSaving(true);
    try {
      await update({
        data: {
          id: row.id,
          prompt: prompt.trim(),
          options: clean,
          correctIndex,
          explanation: explanation.trim(),
        },
      });
      toast.success("Pergunta atualizada.");
      setEditing(false);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou a gravação");
    } finally {
      setSaving(false);
    }
  }

  function shuffleLocal() {
    const pairs = options.map((text, i) => ({ text, correct: i === correctIndex }));
    for (let i = pairs.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j]!, pairs[i]!];
    }
    setOptions(pairs.map((p) => p.text));
    setCorrectIndex(Math.max(0, pairs.findIndex((p) => p.correct)));
  }

  return (
    <li
      className={cn(
        "rounded-xl border border-border bg-surface-2 px-3 py-3 text-xs",
        !row.active && "opacity-50",
      )}
    >
      {editing ? (
        <div className="space-y-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-foreground"
          />
          <ul className="space-y-2">
            {options.map((o, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${row.id}`}
                  checked={i === correctIndex}
                  onChange={() => setCorrectIndex(i)}
                  className="h-4 w-4 accent-[color:var(--color-primary,#c8a24a)]"
                  aria-label={`Marcar opção ${String.fromCharCode(65 + i)} como correta`}
                />
                <span className="w-4 text-center text-muted-foreground">
                  {String.fromCharCode(65 + i)}
                </span>
                <input
                  value={o}
                  onChange={(e) =>
                    setOptions((prev) => prev.map((v, vi) => (vi === i ? e.target.value : v)))
                  }
                  className="flex-1 rounded-lg border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground"
                />
              </li>
            ))}
          </ul>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={2}
            placeholder="Explicação da resposta certa"
            className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-xs text-foreground"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Guardar
            </button>
            <button
              type="button"
              onClick={shuffleLocal}
              className="inline-flex items-center gap-1 text-primary transition hover:underline"
            >
              <Shuffle className="h-3 w-3" /> Misturar opções
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-muted-foreground transition hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-foreground">{row.prompt}</p>
          <ul className="mt-2 space-y-1">
            {row.options.map((o, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-center gap-2",
                  i === row.correct_index ? "text-emerald-500" : "text-muted-foreground",
                )}
              >
                {i === row.correct_index ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span className="w-3 text-center">{String.fromCharCode(65 + i)}</span>
                )}
                {o}
              </li>
            ))}
          </ul>
          {row.explanation && <p className="mt-2 text-muted-foreground">{row.explanation}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-primary transition hover:underline"
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>
            <button
              type="button"
              onClick={async () => {
                await update({ data: { id: row.id, active: !row.active } });
                onRefresh();
              }}
              className="text-primary transition hover:underline"
            >
              {row.active ? "Desativar" : "Ativar"}
            </button>
            <button
              type="button"
              onClick={async () => {
                await remove({ data: { id: row.id } });
                onRefresh();
              }}
              className="inline-flex items-center gap-1 text-red-500 transition hover:underline"
            >
              <Trash2 className="h-3 w-3" /> Eliminar
            </button>
            {row.lesson_title && (
              <span className="text-muted-foreground">Aula: {row.lesson_title}</span>
            )}
          </div>
        </>
      )}
    </li>
  );
}
