import { createFileRoute } from "@tanstack/react-router";
import { Film, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/ferramentas/studio/videos")({
  component: VideosPage,
});

function VideosPage() {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-[color:var(--hairline)] bg-surface-1 p-10 text-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 0%, oklch(0.55 0.22 285 / 0.20), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-xl space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--hairline)] bg-background/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">
            <Sparkles className="h-3 w-3" /> Em preparação
          </span>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/15 text-secondary ring-1 ring-[color:var(--hairline)]">
            <Film className="h-6 w-6" />
          </div>
          <h1 className="font-display text-3xl text-foreground md:text-4xl">IA de Vídeos</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Vídeos publicitários cinematográficos a partir das tuas imagens — storyboard,
            movimentos de câmara e iluminação automáticos. A ligar aos modelos
            Google Veo e Gemini para uma experiência de nível estúdio.
          </p>
          <p className="text-xs text-muted-foreground">
            Estará disponível assim que os modelos de vídeo generativo forem ativados
            para geração dentro da app.
          </p>
        </div>
      </section>
    </div>
  );
}
