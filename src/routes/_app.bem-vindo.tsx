import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, GraduationCap, Target, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { objectives } from "@/data/objectives";
import { courses } from "@/data/courses";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/bem-vindo")({
  head: () => ({
    meta: [
      { title: "Primeiros passos — MM Club" },
      {
        name: "description",
        content:
          "Os teus três primeiros passos no MM Club: objetivo, primeira aula e comunidade privada.",
      },
      { property: "og:title", content: "Primeiros passos — MM Club" },
      {
        property: "og:description",
        content: "Objetivo, primeira aula e comunidade. Começa aqui.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnboardingPage,
});

function firstLessonRef() {
  const course = courses[0];
  const lesson = course?.modules?.[0]?.lessons?.[0];
  return course && lesson
    ? { courseId: course.id, lessonId: lesson.id, courseTitle: course.title, lessonTitle: lesson.title }
    : null;
}

const STEPS = [
  { icon: Target, label: "Objetivo" },
  { icon: GraduationCap, label: "Primeira aula" },
  { icon: Users, label: "Comunidade" },
];

function OnboardingPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [objective, setObjective] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [firstName, setFirstName] = useState("");
  const lesson = firstLessonRef();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id ?? null;
      if (!uid) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, onboarding_step, onboarding_objective")
        .eq("id", uid)
        .maybeSingle();
      if (cancelled) return;
      const p = prof as {
        display_name?: string | null;
        onboarding_step?: number | null;
        onboarding_objective?: string | null;
      } | null;
      setUserId(uid);
      setFirstName((p?.display_name ?? "").split(" ")[0] ?? "");
      setStep(Math.min(2, p?.onboarding_step ?? 0));
      setObjective(p?.onboarding_objective ?? null);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  type ProfilePatch = {
    onboarding_objective?: string | null;
    onboarding_step?: number;
    onboarding_completed_at?: string | null;
  };

  async function patch(values: ProfilePatch) {
    if (!userId) return;
    setSaving(true);
    await supabase.from("profiles").update(values).eq("id", userId);
    setSaving(false);
  }


  async function chooseObjective(id: string) {
    setObjective(id);
    setStep(1);
    await patch({ onboarding_objective: id, onboarding_step: 1 });
  }

  async function goToLesson() {
    await patch({ onboarding_step: 2 });
    if (lesson) {
      navigate({
        to: "/academia/$courseId/$lessonId",
        params: { courseId: lesson.courseId, lessonId: lesson.lessonId },
      });
    } else {
      navigate({ to: "/academia" });
    }
  }

  async function finish(to: "/comunidade" | "/dashboard") {
    await patch({
      onboarding_step: 3,
      onboarding_completed_at: new Date().toISOString(),
    });
    navigate({ to });
  }

  async function skip() {
    await patch({
      onboarding_step: 3,
      onboarding_completed_at: new Date().toISOString(),
    });
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 py-6">
      <header className="space-y-3">
        <p className="font-display text-[10px] uppercase tracking-[0.32em] text-primary">
          Primeiros passos
        </p>
        <h1 className="font-display text-3xl leading-tight text-foreground md:text-5xl">
          {firstName ? `Bem-vindo, ${firstName}.` : "Bem-vindo ao MM Club."}
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Três passos rápidos e ficas a construir. Leva menos de dois minutos.
        </p>
      </header>

      {/* Stepper */}
      <ol className="flex items-center gap-3">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = step > i;
          const active = step === i;
          return (
            <li key={s.label} className="flex flex-1 items-center gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 transition",
                  done
                    ? "bg-primary text-primary-foreground ring-primary"
                    : active
                      ? "bg-surface-2 text-primary ring-primary"
                      : "bg-surface-1 text-muted-foreground ring-border",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={cn(
                  "hidden text-xs font-medium sm:block",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <span className="h-px flex-1 bg-border" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>

      {!loaded ? (
        <div className="h-48 animate-pulse rounded-2xl bg-surface-1" />
      ) : step === 0 ? (
        <section className="space-y-4">
          <h2 className="font-display text-xl text-foreground md:text-2xl">
            Qual é o teu objetivo agora?
          </h2>
          <p className="text-sm text-muted-foreground">
            Usamos isto para te recomendar o percurso certo.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {objectives.map((o) => (
              <button
                key={o.id}
                type="button"
                disabled={saving}
                onClick={() => void chooseObjective(o.id)}
                className={cn(
                  "rounded-2xl bg-surface-1 p-5 text-left ring-1 transition hover:ring-primary",
                  objective === o.id ? "ring-primary" : "ring-border",
                )}
              >
                <p className="font-display text-base text-foreground">{o.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {o.tagline}
                </p>
              </button>
            ))}
          </div>
        </section>
      ) : step === 1 ? (
        <section className="space-y-4 rounded-2xl bg-surface-1 p-6 ring-1 ring-border md:p-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-primary">
            Passo 2 · Academia
          </p>
          <h2 className="font-display text-xl text-foreground md:text-2xl">
            {lesson ? lesson.lessonTitle : "Começa pela Academia"}
          </h2>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            {lesson
              ? `Abre a primeira aula de ${lesson.courseTitle}. É o alicerce de tudo o que vem depois.`
              : "Entra no catálogo e escolhe o teu primeiro curso."}
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={() => void goToLesson()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-gold-soft"
          >
            Ver a primeira aula <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      ) : (
        <section className="space-y-4 rounded-2xl bg-surface-1 p-6 ring-1 ring-border md:p-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-primary">
            Passo 3 · Comunidade
          </p>
          <h2 className="font-display text-xl text-foreground md:text-2xl">
            Apresenta-te ao clube.
          </h2>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            Diz quem és e o que estás a construir. Quem se apresenta recebe muito
            mais das lives e do networking.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void finish("/comunidade")}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-gold-soft"
            >
              Entrar na comunidade <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void finish("/dashboard")}
              className="rounded-full px-5 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Ir para o painel
            </button>
          </div>
        </section>
      )}

      {loaded && (
        <button
          type="button"
          onClick={() => void skip()}
          className="text-xs text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
        >
          Saltar por agora
        </button>
      )}
    </div>
  );
}
