import { useCallback, useEffect, useState } from "react";
import { NotebookPen, Trash2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccessToken } from "@/hooks/use-access-token";
import { cn } from "@/lib/utils";

type Note = {
  id: string;
  course_id: string;
  lesson_id: string;
  seconds: number;
  body: string;
  created_at: string;
};

export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m % 60)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/**
 * Notas pessoais ancoradas ao minuto da aula. O segundo é o último progresso
 * gravado pelo player, por isso a nota fica no momento onde o aluno está.
 */
export function LessonNotes({
  courseId,
  lessonId,
  currentSeconds,
  onSeek,
  className,
}: {
  courseId: string;
  lessonId: string;
  currentSeconds: number;
  onSeek?: (seconds: number) => void;
  className?: string;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { token, ready } = useAccessToken();

  const load = useCallback(async () => {
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => any;
    })
      .from("lesson_notes")
      .select("id, course_id, lesson_id, seconds, body, created_at")
      .eq("course_id", courseId)
      .eq("lesson_id", lessonId)
      .order("seconds", { ascending: true });
    if (error) {
      console.warn("Falha ao carregar notas", error);
      return;
    }
    setNotes((data as Note[]) ?? []);
    setLoaded(true);
  }, [courseId, lessonId]);

  useEffect(() => {
    setNotes([]);
    setLoaded(false);
    // Só ler depois de a sessão estar hidratada: sem isto o pedido sai sem
    // token, o RLS devolve 0 linhas e as notas parecem ter desaparecido.
    if (!ready) return;
    if (!token) {
      setLoaded(true);
      return;
    }
    void load();
  }, [load, ready, token]);


  const add = async () => {
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await (supabase as unknown as { from: (t: string) => any })
        .from("lesson_notes")
        .insert({
          user_id: u.user.id,
          course_id: courseId,
          lesson_id: lessonId,
          seconds: Math.max(0, Math.floor(currentSeconds || 0)),
          body: text,
        })
        .select("id, course_id, lesson_id, seconds, body, created_at")
        .maybeSingle();
      if (data) {
        setNotes((prev) => [...prev, data as Note].sort((a, b) => a.seconds - b.seconds));
        setBody("");
      }
    } catch (error) {
      console.warn("Falha ao gravar nota", error);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await (supabase as unknown as { from: (t: string) => any })
      .from("lesson_notes")
      .delete()
      .eq("id", id);
  };

  return (
    <section className={cn("rounded-3xl border border-border bg-surface-1 p-4 sm:p-5", className)}>
      <div className="flex items-center gap-2">
        <NotebookPen className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base text-foreground">As minhas notas</h3>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" /> {formatSeconds(currentSeconds || 0)}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Escreve uma nota neste momento do vídeo…"
          className="min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
        />
        <button
          type="button"
          onClick={add}
          disabled={saving || !body.trim()}
          className="h-11 shrink-0 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition hover:bg-gold-soft disabled:opacity-50 sm:self-end"
        >
          Guardar nota
        </button>
      </div>

      {loaded && notes.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Ainda sem notas nesta aula. As notas ficam guardadas com o minuto exato.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex items-start gap-3 rounded-2xl bg-surface-2 px-3 py-2 text-sm"
            >
              <button
                type="button"
                onClick={() => onSeek?.(note.seconds)}
                className="mt-0.5 shrink-0 rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[11px] text-primary transition hover:bg-primary/25"
              >
                {formatSeconds(note.seconds)}
              </button>
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-foreground">{note.body}</p>
              <button
                type="button"
                onClick={() => void remove(note.id)}
                aria-label="Apagar nota"
                className="shrink-0 text-muted-foreground transition hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
