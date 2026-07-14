import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Save, RotateCcw, ImageIcon, Sparkles } from "lucide-react";
import { SectionHeading } from "@/components/mm/section-heading";
import { courses } from "@/data/courses";
import { experts } from "@/data/experts";
import {
  applyOverrides,
  loadOverrides,
  saveOverrides,
  type Overrides,
  type CourseOverride,
  type ExpertOverride,
} from "@/data/admin-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({
    meta: [
      { title: "Admin — MM Club" },
      { name: "description", content: "Painel de administração do MM Club." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Overrides>(() => loadOverrides());
  const [tab, setTab] = useState<"courses" | "experts">("courses");
  const [saved, setSaved] = useState(false);

  const updateCourse = (id: string, patch: Partial<CourseOverride>) => {
    setOverrides((o) => ({
      ...o,
      courses: { ...o.courses, [id]: { ...o.courses[id], ...patch } },
    }));
    setSaved(false);
  };
  const updateExpert = (id: string, patch: Partial<ExpertOverride>) => {
    setOverrides((o) => ({
      ...o,
      experts: { ...o.experts, [id]: { ...o.experts[id], ...patch } },
    }));
    setSaved(false);
  };

  const handleSave = () => {
    // Strip empty strings so we fall back to defaults when field is cleared
    const clean: Overrides = { courses: {}, experts: {} };
    for (const [id, patch] of Object.entries(overrides.courses)) {
      const filtered = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined && v !== ""),
      );
      if (Object.keys(filtered).length > 0) clean.courses[id] = filtered;
    }
    for (const [id, patch] of Object.entries(overrides.experts)) {
      const filtered = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined && v !== ""),
      );
      if (Object.keys(filtered).length > 0) clean.experts[id] = filtered;
    }
    saveOverrides(clean);
    applyOverrides(clean);
    setOverrides(clean);
    setSaved(true);
    router.invalidate();
    setTimeout(() => setSaved(false), 2200);
  };

  const handleReset = () => {
    const empty: Overrides = { courses: {}, experts: {} };
    saveOverrides(empty);
    applyOverrides(empty);
    setOverrides(empty);
    router.invalidate();
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Admin"
        title="Painel de administração."
        description="Edita capas, logotipos, títulos e descrições. As alterações são aplicadas em tempo real e guardadas localmente."
      />

      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-border bg-surface-1 p-1">
          {(["courses", "experts"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium transition",
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "courses" ? "Cursos" : "Especialistas"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-4 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Repor
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Save className="h-3.5 w-3.5" />
            {saved ? "Guardado ✓" : "Guardar"}
          </button>
        </div>
      </div>

      {tab === "courses" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {courses.map((c) => {
            const patch = overrides.courses[c.id] ?? {};
            const merged = { ...c, ...patch };
            return (
              <div
                key={c.id}
                className="rounded-2xl border border-border bg-surface-1 p-5"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-[color:var(--hairline)]"
                    style={{ background: merged.cover }}
                  >
                    {merged.logo && (
                      <img
                        src={merged.logo}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{c.id}</p>
                    <p className="truncate font-display text-sm font-semibold">
                      {merged.title}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <Field label="Título">
                    <input
                      className={inputCls}
                      value={patch.title ?? c.title}
                      onChange={(e) => updateCourse(c.id, { title: e.target.value })}
                    />
                  </Field>
                  <Field label="Tagline">
                    <input
                      className={inputCls}
                      value={patch.tagline ?? c.tagline}
                      onChange={(e) => updateCourse(c.id, { tagline: e.target.value })}
                    />
                  </Field>
                  <Field label="Descrição">
                    <textarea
                      className={cn(inputCls, "min-h-[70px] resize-y")}
                      value={patch.description ?? c.description}
                      onChange={(e) => updateCourse(c.id, { description: e.target.value })}
                    />
                  </Field>
                  <Field label="Duração">
                    <input
                      className={inputCls}
                      value={patch.duration ?? c.duration}
                      onChange={(e) => updateCourse(c.id, { duration: e.target.value })}
                    />
                  </Field>
                  <Field
                    label="Capa (URL da imagem ou CSS background)"
                    icon={<ImageIcon className="h-3 w-3" />}
                  >
                    <input
                      className={inputCls}
                      placeholder="https://... ou linear-gradient(...)"
                      value={patch.cover ?? c.cover}
                      onChange={(e) => updateCourse(c.id, { cover: e.target.value })}
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Dica: para uma imagem cheia usa{" "}
                      <code className="text-foreground/70">url(URL) center/cover no-repeat, #000</code>
                    </p>
                  </Field>
                  <Field label="Logotipo (URL)" icon={<Sparkles className="h-3 w-3" />}>
                    <input
                      className={inputCls}
                      placeholder="https://..."
                      value={patch.logo ?? c.logo ?? ""}
                      onChange={(e) => updateCourse(c.id, { logo: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "experts" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {experts.map((ex) => {
            const patch = overrides.experts[ex.id] ?? {};
            const merged = { ...ex, ...patch };
            return (
              <div
                key={ex.id}
                className="rounded-2xl border border-border bg-surface-1 p-5"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="h-14 w-14 shrink-0 overflow-hidden rounded-full ring-1 ring-[color:var(--hairline)]"
                    style={merged.logo ? { background: "#000" } : { background: merged.photo }}
                  >
                    {merged.logo && (
                      <img
                        src={merged.logo}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{ex.id}</p>
                    <p className="truncate font-display text-sm font-semibold">
                      {merged.name}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <Field label="Nome">
                    <input
                      className={inputCls}
                      value={patch.name ?? ex.name}
                      onChange={(e) => updateExpert(ex.id, { name: e.target.value })}
                    />
                  </Field>
                  <Field label="Função">
                    <input
                      className={inputCls}
                      value={patch.role ?? ex.role}
                      onChange={(e) => updateExpert(ex.id, { role: e.target.value })}
                    />
                  </Field>
                  <Field label="Bio curta">
                    <textarea
                      className={cn(inputCls, "min-h-[60px] resize-y")}
                      value={patch.shortBio ?? ex.shortBio}
                      onChange={(e) => updateExpert(ex.id, { shortBio: e.target.value })}
                    />
                  </Field>
                  <Field label="Foto (URL ou gradient)">
                    <input
                      className={inputCls}
                      value={patch.photo ?? ex.photo}
                      onChange={(e) => updateExpert(ex.id, { photo: e.target.value })}
                    />
                  </Field>
                  <Field label="Logotipo (URL)">
                    <input
                      className={inputCls}
                      placeholder="https://..."
                      value={patch.logo ?? ex.logo ?? ""}
                      onChange={(e) => updateExpert(ex.id, { logo: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
