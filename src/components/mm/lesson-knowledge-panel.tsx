import { useEffect, useState } from "react";
import { Brain, Loader2, CheckCircle2, AlertCircle, Wand2, Save } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  getLessonTranscript,
  ingestLessonTranscript,
  transcribeLessonFromUrl,
} from "@/lib/lesson-knowledge.functions";

type Props = {
  courseId: string;
  courseTitle?: string;
  lessonId: string;
  lessonTitle?: string;
  videoUrl?: string;
};

export function LessonKnowledgePanel({
  courseId,
  courseTitle,
  lessonId,
  lessonTitle,
  videoUrl,
}: Props) {
  const load = useServerFn(getLessonTranscript);
  const ingest = useServerFn(ingestLessonTranscript);
  const transcribe = useServerFn(transcribeLessonFromUrl);

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState<"idle" | "transcribe" | "save">("idle");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const row = await load({ data: { courseId, lessonId } });
        if (cancelled) return;
        setStatus((row as any)?.status ?? null);
        setTranscript(((row as any)?.transcript as string) ?? "");
      } catch (e: any) {
        setMsg({ kind: "err", text: e?.message ?? "Erro ao carregar" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, courseId, lessonId, load]);

  async function handleTranscribe() {
    if (!videoUrl) {
      setMsg({ kind: "err", text: "Adiciona um URL de vídeo primeiro." });
      return;
    }
    setBusy("transcribe");
    setMsg(null);
    try {
      const res = (await transcribe({
        data: { courseId, lessonId, courseTitle, lessonTitle, videoUrl },
      })) as { transcript?: string; chunks?: number };
      setStatus("ready");
      if (res?.transcript) setTranscript((prev) => prev || res.transcript!);
      setMsg({ kind: "ok", text: `Transcrito e indexado (${res?.chunks ?? "?"} pedaços).` });
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message ?? "Falhou a transcrição" });
    } finally {
      setBusy("idle");
    }
  }

  async function handleSave() {
    if (transcript.trim().length < 20) {
      setMsg({ kind: "err", text: "Transcrição demasiado curta." });
      return;
    }
    setBusy("save");
    setMsg(null);
    try {
      const res = (await ingest({
        data: {
          courseId,
          lessonId,
          courseTitle,
          lessonTitle,
          videoUrl,
          transcript: transcript.trim(),
          language: "pt",
        },
      })) as { chunks?: number };
      setStatus("ready");
      setMsg({ kind: "ok", text: `Indexado (${res?.chunks ?? "?"} pedaços).` });
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message ?? "Falhou o guardar" });
    } finally {
      setBusy("idle");
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-1/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Brain className="h-4 w-4 text-primary" />
          Base de conhecimento MM Intelligence
          {status === "ready" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
              <CheckCircle2 className="h-3 w-3" /> pronto
            </span>
          )}
          {status && status !== "ready" && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-500">
              {status}
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{open ? "Fechar" : "Abrir"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-4 py-4">
          <p className="text-xs text-muted-foreground">
            Transcrição automática a correr em segundo plano: a cada 3 minutos o sistema
            escolhe a próxima aula com vídeo e transcreve-a. Não precisas de clicar em
            nada — os botões abaixo servem só para forçar já esta aula ou colar texto manualmente.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleTranscribe}
              disabled={busy !== "idle" || !videoUrl}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {busy === "transcribe" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              Transcrever automático
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy !== "idle"}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-4 py-2 text-xs font-semibold transition hover:bg-surface-3 disabled:opacity-50"
            >
              {busy === "save" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Guardar e indexar
            </button>
          </div>

          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={8}
            placeholder="Cola aqui a transcrição da aula, ou usa 'Transcrever automático'."
            className="w-full resize-y rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
          />

          {msg && (
            <div
              className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                msg.kind === "ok"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-red-500/10 text-red-500"
              }`}
            >
              {msg.kind === "ok" ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
              )}
              <span>{msg.text}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
