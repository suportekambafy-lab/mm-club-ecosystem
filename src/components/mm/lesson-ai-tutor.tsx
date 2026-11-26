import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { createThread } from "@/lib/jade-threads.functions";

/** Atalhos para perguntar ao MM Inteligence sobre a aula aberta. */
export function LessonAiTutor({ courseTitle, moduleTitle, lessonTitle }: { courseTitle: string; moduleTitle: string; lessonTitle: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const newThread = useServerFn(createThread);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = `aula «${lessonTitle}» (módulo «${moduleTitle}», curso «${courseTitle}»)`;
  const actions = [
    { key: "resumo", label: "Resumo da aula", q: `Faz-me um resumo claro dos pontos principais da ${ref}.` },
    { key: "plano", label: "Plano de ação em 3 passos", q: `Com base na ${ref}, dá-me um plano de ação prático em 3 passos para aplicar já no meu negócio.` },
    { key: "duvida", label: "Tirar uma dúvida", q: `Tenho uma dúvida sobre a ${ref}: ` },
  ];

  const go = async (key: string, q: string) => {
    if (busy) return;
    setBusy(key);
    try {
      const t = await newThread();
      await qc.invalidateQueries({ queryKey: ["ai-threads"] });
      await navigate({ to: "/jade/$threadId", params: { threadId: t.id }, search: { q, send: key !== "duvida" ? 1 : undefined } });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-surface-1 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base text-foreground">Perguntar ao MM Inteligence sobre esta aula</h3>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((a) => (
          <button key={a.key} type="button" disabled={!!busy} onClick={() => void go(a.key, a.q)} className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface-2 px-4 text-xs font-medium text-foreground transition hover:border-primary/50 disabled:opacity-60">
            {busy === a.key && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{a.label}
          </button>
        ))}
      </div>
    </section>
  );
}
