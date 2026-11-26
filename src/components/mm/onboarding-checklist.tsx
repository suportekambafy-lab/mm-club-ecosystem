import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { onboardingSteps, type OnboardingFacts } from "@/lib/club/member-tenure";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "mm-onboarding-dismissed";

/** Checklist de boas-vindas para membros novos (primeiros 30 dias). */
export function OnboardingChecklist({ userId }: { userId: string }) {
  const [facts, setFacts] = useState<OnboardingFacts | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(`${DISMISS_KEY}:${userId}`)) return;
    let cancelled = false;
    void (async () => {
      const [profile, progress, posts, threads] = await Promise.all([
        supabase.from("profiles").select("avatar_url, bio, created_at").eq("id", userId).maybeSingle(),
        supabase.from("lesson_progress").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("community_posts").select("id", { count: "exact", head: true }).eq("author_id", userId),
        supabase.from("ai_threads").select("id", { count: "exact", head: true }).eq("user_id", userId).neq("title", "Nova conversa"),
      ]);
      if (cancelled || !profile.data) return;
      const ageDays = (Date.now() - new Date(profile.data.created_at).getTime()) / 86_400_000;
      if (ageDays > 30) return;
      const f: OnboardingFacts = {
        watchedLesson: (progress.count ?? 0) > 0,
        profileDone: !!profile.data.avatar_url && !!profile.data.bio?.trim(),
        posted: (posts.count ?? 0) > 0,
        askedAi: (threads.count ?? 0) > 0,
      };
      if (Object.values(f).every(Boolean)) return;
      setFacts(f);
      setHidden(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (hidden || !facts) return null;
  const steps = onboardingSteps(facts);
  const done = steps.filter((s) => s.done).length;

  return (
    <section className="surface-card p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><Sparkles className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="type-eyebrow text-primary">Bem-vindo ao MM Club</p>
          <h2 className="font-display text-lg text-foreground">Os teus primeiros passos · {done}/{steps.length}</h2>
        </div>
        <button type="button" aria-label="Esconder" onClick={() => { localStorage.setItem(`${DISMISS_KEY}:${userId}`, "1"); setHidden(true); }} className="rounded-full p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.key}>
            <Link to={s.to} className={cn("flex items-center gap-3 rounded-2xl border border-border bg-surface-2 px-3 py-2.5 text-sm transition hover:border-primary/50", s.done && "opacity-60")}>
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1", s.done ? "bg-primary text-primary-foreground ring-primary" : "ring-border text-transparent")}><Check className="h-3.5 w-3.5" /></span>
              <span className={cn("min-w-0 flex-1", s.done && "line-through")}>{s.label}</span>
              {!s.done && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
