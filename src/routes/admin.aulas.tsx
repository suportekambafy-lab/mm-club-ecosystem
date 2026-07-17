import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Save,
  RotateCcw,
  PlayCircle,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  FolderPlus,
} from "lucide-react";
import { SectionHeading } from "@/components/mm/section-heading";
import { MediaField } from "@/components/mm/media-field";
import { courses } from "@/data/courses";
import {
  applyOverrides,
  loadOverrides,
  saveOverrides,
  type Overrides,
} from "@/data/admin-store";
import type { Module, Lesson } from "@/data/types";
import { parseVideoUrl } from "@/lib/video-source";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/aulas")({
  component: AdminAulas,
});

function cloneModules(mods: Module[] | undefined): Module[] {
  return (mods ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    lessons: m.lessons.map((l) => ({ ...l })),
  }));
}

function AdminAulas() {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Overrides>(() => loadOverrides());
  const [saved, setSaved] = useState(false);
  const [openCourse, setOpenCourse] = useState<string>(courses[0]?.id ?? "");

  // Per-course working copy of modules. Seeded from overrides.modulesByCourse
  // or the current course.modules snapshot.
  const [modulesByCourse, setModulesByCourse] = useState<Record<string, Module[]>>(() => {
    const initial: Record<string, Module[]> = {};
    for (const c of courses) {
      initial[c.id] = cloneModules(overrides.modulesByCourse[c.id] ?? c.modules);
    }
    return initial;
  });

  const current = useMemo(() => courses.find((c) => c.id === openCourse), [openCourse]);
  const modules = modulesByCourse[openCourse] ?? [];

  // Autosave — persist every edit to localStorage + apply to in-memory data,
  // so edits never revert and switching tabs restores the working copy.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const t = setTimeout(() => {
      const clean: Overrides = {
        courses: overrides.courses,
        experts: overrides.experts,
        lessons: {},
        modulesByCourse: {},
      };
      for (const c of courses) {
        clean.modulesByCourse[c.id] = modulesByCourse[c.id] ?? cloneModules(c.modules);
      }
      saveOverrides(clean);
      applyOverrides(clean);
      setSaved(true);
      const clear = setTimeout(() => setSaved(false), 1500);
      return () => clearTimeout(clear);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modulesByCourse]);

  const patchModules = (courseId: string, next: Module[]) => {
    setModulesByCourse((s) => ({ ...s, [courseId]: next }));
    setSaved(false);
  };

  // ------ Module actions ------
  const addModule = () => {
    const next: Module = {
      id: `m-${Date.now().toString(36)}`,
      title: `Novo módulo ${modules.length + 1}`,
      lessons: [],
    };
    patchModules(openCourse, [...modules, next]);
  };
  const removeModule = (idx: number) => {
    if (!confirm("Remover este módulo e todas as suas aulas?")) return;
    patchModules(openCourse, modules.filter((_, i) => i !== idx));
  };
  const moveModule = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= modules.length) return;
    const copy = [...modules];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    patchModules(openCourse, copy);
  };
  const updateModule = (idx: number, patch: Partial<Module>) => {
    patchModules(
      openCourse,
      modules.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    );
  };

  // ------ Lesson actions ------
  const addLesson = (moduleIdx: number) => {
    const next: Lesson = {
      id: `l-${Date.now().toString(36)}`,
      title: "Nova aula",
      duration: "10m",
      videoUrl: "",
    };
    patchModules(
      openCourse,
      modules.map((m, i) =>
        i === moduleIdx ? { ...m, lessons: [...m.lessons, next] } : m,
      ),
    );
  };
  const removeLesson = (moduleIdx: number, lessonIdx: number) => {
    if (!confirm("Remover esta aula?")) return;
    patchModules(
      openCourse,
      modules.map((m, i) =>
        i === moduleIdx
          ? { ...m, lessons: m.lessons.filter((_, li) => li !== lessonIdx) }
          : m,
      ),
    );
  };
  const moveLesson = (moduleIdx: number, lessonIdx: number, dir: -1 | 1) => {
    const j = lessonIdx + dir;
    const mod = modules[moduleIdx];
    if (!mod || j < 0 || j >= mod.lessons.length) return;
    const lessons = [...mod.lessons];
    [lessons[lessonIdx], lessons[j]] = [lessons[j], lessons[lessonIdx]];
    patchModules(
      openCourse,
      modules.map((m, i) => (i === moduleIdx ? { ...m, lessons } : m)),
    );
  };
  const updateLesson = (moduleIdx: number, lessonIdx: number, patch: Partial<Lesson>) => {
    patchModules(
      openCourse,
      modules.map((m, i) =>
        i === moduleIdx
          ? {
              ...m,
              lessons: m.lessons.map((l, li) => (li === lessonIdx ? { ...l, ...patch } : l)),
            }
          : m,
      ),
    );
  };

  // ------ Save / Reset ------
  const handleSave = () => {
    const clean: Overrides = {
      courses: {},
      experts: {},
      lessons: {}, // legacy per-lesson patches no longer written from this page
      modulesByCourse: {},
    };
    // Preserve untouched sections from stored overrides
    for (const [k, v] of Object.entries(overrides.courses)) clean.courses[k] = v;
    for (const [k, v] of Object.entries(overrides.experts)) clean.experts[k] = v;

    // Write full modules for every course we manage
    for (const c of courses) {
      clean.modulesByCourse[c.id] = modulesByCourse[c.id] ?? cloneModules(c.modules);
    }

    saveOverrides(clean);
    applyOverrides(clean);
    setOverrides(clean);
    setSaved(true);
    router.invalidate();
    setTimeout(() => setSaved(false), 2200);
  };

  const handleReset = () => {
    const cleared: Overrides = {
      ...overrides,
      lessons: {},
      modulesByCourse: {},
    };
    saveOverrides(cleared);
    applyOverrides(cleared);
    setOverrides(cleared);
    // Reset local working copy from the (now-restored) originals
    const initial: Record<string, Module[]> = {};
    for (const c of courses) initial[c.id] = cloneModules(c.modules);
    setModulesByCourse(initial);
    router.invalidate();
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Admin › Aulas"
        title="Editor de módulos e aulas."
        description="Adiciona, remove ou reordena módulos e aulas. Cada aula aceita upload de vídeo ou link (YouTube, Vimeo, Bunny)."
      />

      <div className="sticky top-24 z-10 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-4 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Repor originais
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <Save className="h-3.5 w-3.5" />
          {saved ? "Guardado ✓" : "Guarda automaticamente"}
        </button>
      </div>

      {/* Course tabs */}
      <div className="flex flex-wrap gap-2">
        {courses.map((c) => (
          <button
            key={c.id}
            onClick={() => setOpenCourse(c.id)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs transition",
              openCourse === c.id
                ? "border-primary/50 bg-primary text-primary-foreground"
                : "border-border bg-surface-1 text-muted-foreground hover:text-foreground",
            )}
          >
            {c.title}
          </button>
        ))}
      </div>

      {current && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {modules.length} {modules.length === 1 ? "módulo" : "módulos"} ·{" "}
              {modules.reduce((s, m) => s + m.lessons.length, 0)} aulas
            </p>
            <button
              type="button"
              onClick={addModule}
              className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Adicionar módulo
            </button>
          </div>

          {modules.map((m, mi) => (
            <div key={m.id} className="rounded-2xl border border-border bg-surface-1 p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Módulo {String(mi + 1).padStart(2, "0")}
                </span>
                <input
                  className={cn(inputCls, "flex-1")}
                  value={m.title}
                  onChange={(e) => updateModule(mi, { title: e.target.value })}
                  placeholder="Título do módulo"
                />
                <IconBtn onClick={() => moveModule(mi, -1)} disabled={mi === 0} title="Mover cima">
                  <ArrowUp className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn
                  onClick={() => moveModule(mi, 1)}
                  disabled={mi === modules.length - 1}
                  title="Mover baixo"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn onClick={() => removeModule(mi)} title="Remover módulo" danger>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconBtn>
              </div>

              <div className="space-y-4">
                {m.lessons.map((l, li) => {
                  const src = parseVideoUrl(l.videoUrl);
                  return (
                    <div
                      key={l.id}
                      className="rounded-xl border border-border bg-background p-4"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
                          <PlayCircle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                            Aula {li + 1} · {src.kind !== "unknown" ? src.kind : "sem vídeo"}
                          </p>
                        </div>
                        <IconBtn
                          onClick={() => moveLesson(mi, li, -1)}
                          disabled={li === 0}
                          title="Mover cima"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn
                          onClick={() => moveLesson(mi, li, 1)}
                          disabled={li === m.lessons.length - 1}
                          title="Mover baixo"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn onClick={() => removeLesson(mi, li)} title="Remover aula" danger>
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconBtn>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <label className="md:col-span-2 block">
                          <span className={labelCls}>Título</span>
                          <input
                            className={inputCls}
                            value={l.title}
                            onChange={(e) => updateLesson(mi, li, { title: e.target.value })}
                          />
                        </label>
                        <label className="block">
                          <span className={labelCls}>Duração</span>
                          <input
                            className={inputCls}
                            placeholder="12m"
                            value={l.duration}
                            onChange={(e) => updateLesson(mi, li, { duration: e.target.value })}
                          />
                        </label>
                      </div>

                      <div className="mt-3">
                        <MediaField
                          label="Vídeo da aula"
                          bucket="lesson-videos"
                          keyPrefix={`lessons/${current.id}/${l.id}`}
                          accept="video/*"
                          value={l.videoUrl ?? ""}
                          onChange={(v) => updateLesson(mi, li, { videoUrl: v })}
                          placeholder="Cola link (YouTube, Vimeo, Bunny) ou faz upload"
                          helper="Suporta YouTube, Vimeo, Bunny.net (iframe.mediadelivery.net) e ficheiros .mp4/.webm."
                        />
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => addLesson(mi)}
                  className="inline-flex items-center gap-2 rounded-full border border-dashed border-border bg-transparent px-4 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar aula
                </button>
              </div>
            </div>
          ))}

          {!modules.length && (
            <div className="rounded-2xl border border-dashed border-border bg-surface-1 p-6 text-sm text-muted-foreground">
              Ainda não há módulos. Adiciona o primeiro para começar.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition",
        disabled
          ? "cursor-not-allowed border-border/50 text-muted-foreground/40"
          : danger
            ? "border-border bg-surface-1 text-muted-foreground hover:border-destructive/50 hover:text-destructive"
            : "border-border bg-surface-1 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20";
const labelCls =
  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80";
