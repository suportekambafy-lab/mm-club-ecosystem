import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Save,
  RotateCcw,
  PlayCircle,
  Plus,
  Trash2,
  FolderPlus,
  GripVertical,
  ChevronDown,
  Send,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SectionHeading } from "@/components/mm/section-heading";
import { MediaField } from "@/components/mm/media-field";
import { LessonKnowledgePanel } from "@/components/mm/lesson-knowledge-panel";
import { courses } from "@/data/courses";
import {
  applyOverrides,
  loadOverrides,
  saveOverrides,
  pushOverridesToServer,
  type Overrides,
} from "@/data/admin-store";
import type { Module, Lesson } from "@/data/types";
import { parseVideoUrl } from "@/lib/video-source";
import { cn } from "@/lib/utils";
import { notifyNewLesson } from "@/lib/broadcasts.functions";

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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [drag, setDrag] = useState<
    | { kind: "module"; mi: number }
    | { kind: "lesson"; mi: number; li: number }
    | null
  >(null);
  const [over, setOver] = useState<string | null>(null);

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
      newCourses: overrides.newCourses ?? [],
      newExperts: overrides.newExperts ?? [],
      };
      for (const c of courses) {
        clean.modulesByCourse[c.id] = modulesByCourse[c.id] ?? cloneModules(c.modules);
      }
      saveOverrides(clean);
      applyOverrides(clean);
      void pushOverridesToServer(clean);
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

  // ------ Drag & drop reorder ------
  const reorderModule = (from: number, to: number) => {
    if (from === to || to < 0 || to >= modules.length) return;
    const copy = [...modules];
    const [m] = copy.splice(from, 1);
    copy.splice(to, 0, m);
    patchModules(openCourse, copy);
  };
  const moveLessonTo = (fromMi: number, fromLi: number, toMi: number, toLi: number) => {
    if (fromMi === toMi && fromLi === toLi) return;
    const copy = modules.map((m) => ({ ...m, lessons: [...m.lessons] }));
    const src = copy[fromMi];
    const dst = copy[toMi];
    if (!src || !dst) return;
    const [lesson] = src.lessons.splice(fromLi, 1);
    if (!lesson) return;
    const index = Math.max(0, Math.min(toLi, dst.lessons.length));
    dst.lessons.splice(index, 0, lesson);
    patchModules(openCourse, copy);
  };


  // ------ Save / Reset ------
  const handleSave = () => {
    const clean: Overrides = {
      courses: {},
      experts: {},
      lessons: {}, // legacy per-lesson patches no longer written from this page
      modulesByCourse: {},
      newCourses: overrides.newCourses ?? [],
      newExperts: overrides.newExperts ?? [],
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
    void pushOverridesToServer(clean);
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
      newCourses: overrides.newCourses ?? [],
      newExperts: overrides.newExperts ?? [],
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
        description="Adiciona, remove ou reordena módulos e aulas. Cada aula aceita upload de vídeo ou link (YouTube, Vimeo, Bunny, Panda Video)."
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {modules.length} {modules.length === 1 ? "módulo" : "módulos"} ·{" "}
              {modules.reduce((s, m) => s + m.lessons.length, 0)} aulas ·{" "}
              <span className="text-muted-foreground/70">arrasta pelo ⠿ para reordenar</span>
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

          {modules.map((m, mi) => {
            const isCollapsed = collapsed[m.id];
            return (
              <div
                key={m.id}
                onDragOver={(e) => {
                  if (!drag) return;
                  e.preventDefault();
                  setOver(drag.kind === "module" ? `m-${mi}` : `l-${mi}-${m.lessons.length}`);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!drag) return;
                  if (drag.kind === "module") reorderModule(drag.mi, mi);
                  else moveLessonTo(drag.mi, drag.li, mi, m.lessons.length);
                  setDrag(null);
                  setOver(null);
                }}
                className={cn(
                  "rounded-2xl border bg-surface-1 transition",
                  over === `m-${mi}` && drag?.kind === "module"
                    ? "border-primary/60 ring-1 ring-primary/30"
                    : "border-border",
                  drag?.kind === "module" && drag.mi === mi && "opacity-50",
                )}
              >
                {/* Module header */}
                <div className="flex items-center gap-2 px-4 py-3">
                  <span
                    draggable
                    onDragStart={() => setDrag({ kind: "module", mi })}
                    onDragEnd={() => {
                      setDrag(null);
                      setOver(null);
                    }}
                    title="Arrastar módulo"
                    className="cursor-grab select-none px-1 text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
                  >
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <button
                    type="button"
                    onClick={() => setCollapsed((s) => ({ ...s, [m.id]: !s[m.id] }))}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:text-foreground"
                    title={isCollapsed ? "Expandir" : "Recolher"}
                  >
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform", isCollapsed && "-rotate-90")}
                    />
                  </button>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                    {String(mi + 1).padStart(2, "0")}
                  </span>
                  <input
                    className={cn(
                      "flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-semibold text-foreground outline-none transition hover:border-border focus:border-primary/50 focus:bg-background",
                    )}
                    value={m.title}
                    onChange={(e) => updateModule(mi, { title: e.target.value })}
                    placeholder="Título do módulo"
                  />
                  <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] text-muted-foreground">
                    {m.lessons.length} {m.lessons.length === 1 ? "aula" : "aulas"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCollapsed((s) => ({ ...s, [m.id]: false }));
                      addLesson(mi);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" />
                    Adicionar aula
                  </button>
                  <IconBtn onClick={() => removeModule(mi)} title="Remover módulo" danger>
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconBtn>
                </div>

                {/* Lessons */}
                {!isCollapsed && (
                  <div className="space-y-2 border-t border-border/60 px-4 py-3">
                    {m.lessons.map((l, li) => {
                      const src = parseVideoUrl(l.videoUrl);
                      const isOpen = expandedLesson === l.id;
                      return (
                        <div
                          key={l.id}
                          onDragOver={(e) => {
                            if (drag?.kind !== "lesson") return;
                            e.preventDefault();
                            e.stopPropagation();
                            setOver(`l-${mi}-${li}`);
                          }}
                          onDrop={(e) => {
                            if (drag?.kind !== "lesson") return;
                            e.preventDefault();
                            e.stopPropagation();
                            moveLessonTo(drag.mi, drag.li, mi, li);
                            setDrag(null);
                            setOver(null);
                          }}
                          className={cn(
                            "rounded-xl border bg-background transition",
                            over === `l-${mi}-${li}` && drag?.kind === "lesson"
                              ? "border-primary/60 ring-1 ring-primary/25"
                              : "border-border",
                            drag?.kind === "lesson" &&
                              drag.mi === mi &&
                              drag.li === li &&
                              "opacity-50",
                          )}
                        >
                          <div className="flex items-center gap-2 px-3 py-2.5">
                            <span
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                setDrag({ kind: "lesson", mi, li });
                              }}
                              onDragEnd={() => {
                                setDrag(null);
                                setOver(null);
                              }}
                              title="Arrastar aula"
                              className="cursor-grab select-none px-0.5 text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
                            >
                              <GripVertical className="h-4 w-4" />
                            </span>
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
                              <PlayCircle className="h-4 w-4" />
                            </div>
                            <button
                              type="button"
                              onClick={() => setExpandedLesson(isOpen ? null : l.id)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <p className="truncate text-sm font-medium text-foreground">
                                {l.title || "Sem título"}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                Aula {li + 1} · {l.duration || "—"} ·{" "}
                                {src.kind !== "unknown" ? src.kind : "sem vídeo"}
                              </p>
                            </button>
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-1 text-[10px] font-medium",
                                l.videoUrl
                                  ? "bg-primary/10 text-primary"
                                  : "bg-surface-1 text-muted-foreground",
                              )}
                            >
                              {l.videoUrl ? "Publicado" : "Rascunho"}
                            </span>
                            <IconBtn
                              onClick={() => setExpandedLesson(isOpen ? null : l.id)}
                              title={isOpen ? "Fechar" : "Editar"}
                            >
                              <ChevronDown
                                className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")}
                              />
                            </IconBtn>
                            <IconBtn onClick={() => removeLesson(mi, li)} title="Remover aula" danger>
                              <Trash2 className="h-3.5 w-3.5" />
                            </IconBtn>
                          </div>

                          {isOpen && (
                            <div className="border-t border-border/60 p-4">
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                <label className="md:col-span-2 block">
                                  <span className={labelCls}>Título</span>
                                  <input
                                    className={inputCls}
                                    value={l.title}
                                    onChange={(e) => updateLesson(mi, li, { title: e.target.value })}
                                  />
                                </label>
                                <DurationField
                                  value={l.duration}
                                  videoUrl={l.videoUrl}
                                  onChange={(v) => updateLesson(mi, li, { duration: v })}
                                />

                              </div>

                              <div className="mt-3">
                                <MediaField
                                  label="Vídeo da aula"
                                  bucket="lesson-videos"
                                  keyPrefix={`lessons/${current.id}/${l.id}`}
                                  accept="video/*"
                                  value={l.videoUrl ?? ""}
                                  onChange={(v) => updateLesson(mi, li, { videoUrl: v })}
                                  placeholder="Cola link (YouTube, Vimeo, Bunny, Panda) ou faz upload"
                                  helper="Suporta YouTube, Vimeo, Bunny.net (iframe.mediadelivery.net), Panda Video (player-vz-….tv.pandavideo.com.br/embed/?v=…) e ficheiros .mp4/.webm."
                                />
                              </div>
                              <div className="mt-3">
                                <MediaField
                                  label="Thumbnail da aula"
                                  bucket="course-media"
                                  keyPrefix={`lessons/${current.id}/${l.id}/thumb`}
                                  accept="image/*"
                                  value={l.cover ?? ""}
                                  onChange={(v) => updateLesson(mi, li, { cover: v })}
                                  placeholder="Cola URL da imagem ou faz upload"
                                  helper="Imagem usada em ‘Continua a assistir’ e nas capas da Academia."
                                />
                              </div>

                              <LessonKnowledgePanel
                                courseId={current.id}
                                courseTitle={current.title}
                                lessonId={l.id}
                                lessonTitle={l.title}
                                videoUrl={l.videoUrl}
                              />

                              <NotifyLessonButton
                                courseId={current.id}
                                courseTitle={current.title}
                                lessonId={l.id}
                                lessonTitle={l.title}
                                visibility={current.visibility}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {!m.lessons.length && (
                      <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                        Sem aulas neste módulo — arrasta uma aula para aqui ou adiciona.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

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

function NotifyLessonButton(props: {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  visibility: string;
}) {
  const notify = useServerFn(notifyNewLesson);
  const [sending, setSending] = useState(false);
  const onClick = async () => {
    if (sending) return;
    if (!confirm(`Enviar email "Nova aula: ${props.lessonTitle}" para todos os alunos com acesso?`)) return;
    setSending(true);
    try {
      const vis = (["public", "club", "premium", "purchased"] as const).includes(
        props.visibility as any,
      )
        ? (props.visibility as "public" | "club" | "premium" | "purchased")
        : "club";
      const res = await notify({
        data: {
          courseId: props.courseId,
          courseTitle: props.courseTitle,
          lessonId: props.lessonId,
          lessonTitle: props.lessonTitle,
          visibility: vis,
        },
      });
      toast.success(`Emails enviados: ${res.sent} · ignorados: ${res.skipped}`);
    } catch (e: any) {
      toast.error(`Falha ao enviar: ${e?.message ?? e}`);
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="mt-3 flex items-center justify-end">
      <button
        type="button"
        onClick={onClick}
        disabled={sending}
        className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:opacity-50"
      >
        <Send className="h-3.5 w-3.5" />
        {sending ? "A enviar..." : "Notificar alunos por email"}
      </button>
    </div>
  );
}


const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20";
const labelCls =
  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80";
