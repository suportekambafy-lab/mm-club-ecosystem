import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { MemberAvatar } from "@/components/mm/member-avatar";
import { toast } from "sonner";

type Row = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type Profile = { display_name: string | null; avatar_url: string | null };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

/**
 * Mural de comentários de um curso — disponível também enquanto o curso está
 * "Em breve", para os alunos poderem falar sobre o lançamento.
 */
export function CourseComments({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId?: string;
}) {
  const { user, isAdmin } = useCurrentUser();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    let query = supabase
      .from("course_comments")
      .select("id,user_id,body,created_at")
      .eq("course_id", courseId);
    query = lessonId ? query.eq("lesson_id", lessonId) : query.is("lesson_id", null);
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      setRows([]);
      return;
    }
    const list = (data ?? []) as Row[];
    setRows(list);
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_url")
        .in("id", ids);
      const map: Record<string, Profile> = {};
      for (const p of profs ?? []) {
        map[p.id as string] = {
          display_name: p.display_name as string | null,
          avatar_url: p.avatar_url as string | null,
        };
      }
      setProfiles(map);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const count = rows?.length ?? 0;

  const canSend = useMemo(
    () => Boolean(user) && body.trim().length > 1 && !sending,
    [user, body, sending],
  );

  async function send() {
    if (!user || !canSend) return;
    setSending(true);
    const text = body.trim().slice(0, 1200);
    const { error } = await supabase
      .from("course_comments")
      .insert({ course_id: courseId, user_id: user.id, body: text });
    setSending(false);
    if (error) {
      toast.error("Não foi possível publicar o comentário.");
      return;
    }
    setBody("");
    await load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("course_comments").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível apagar.");
      return;
    }
    setRows((prev) => (prev ?? []).filter((r) => r.id !== id));
  }

  return (
    <section className="surface-card space-y-5 p-5 md:p-6">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-primary" />
        <h2 className="type-section text-foreground">Comentários</h2>
        {count > 0 && <span className="text-xs text-muted-foreground">{count}</span>}
      </div>

      {user ? (
        <div className="flex items-start gap-3">
          <MemberAvatar name={user.name} avatarUrl={null} size={32} />
          <div className="min-w-0 flex-1 space-y-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              maxLength={1200}
              placeholder="Escreve um comentário…"
              className="w-full resize-none rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/50"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void send()}
                disabled={!canSend}
                className="tap-target inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Publicar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rows === null ? (
        <p className="text-xs text-muted-foreground">A carregar comentários…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Ainda não há comentários. Sê o primeiro a comentar.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const prof = profiles[r.user_id];
            const name = prof?.display_name ?? "Membro";
            return (
              <li key={r.id} className="flex items-start gap-3">
                <MemberAvatar name={name} avatarUrl={prof?.avatar_url ?? null} size={32} />
                <div className="min-w-0 flex-1 rounded-2xl border border-border bg-surface-2 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-foreground">{name}</span>
                    <span className="text-muted-foreground">{timeAgo(r.created_at)}</span>
                    {(isAdmin || r.user_id === user?.id) && (
                      <button
                        type="button"
                        onClick={() => void remove(r.id)}
                        aria-label="Apagar comentário"
                        className="ml-auto text-muted-foreground transition hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]">
                    {r.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
