/**
 * Mensagens do MM Suporte: conversas guardadas de cada membro com o
 * assistente, para a equipa acompanhar e marcar como tratadas.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Headset, Loader2, MessageSquare, Search, UserRound } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import { toast } from "sonner";
import {
  getSupportThreadMessages,
  listSupportThreads,
  setSupportThreadHandled,
  type SupportThreadRow,
} from "@/lib/support-admin.functions";
import { MemberAvatar } from "@/components/mm/member-avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/suporte")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mensagens de suporte — MM Admin" },
      {
        name: "description",
        content: "Conversas do MM Suporte com os membros do MM Club, para acompanhamento da equipa.",
      },
      { property: "og:title", content: "Mensagens de suporte — MM Admin" },
      {
        property: "og:description",
        content: "Acompanha as conversas do assistente de suporte e os pedidos passados para humano.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminSuportePage,
});

function when(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: pt });
  } catch {
    return "";
  }
}

function AdminSuportePage() {
  const listFn = useServerFn(listSupportThreads);
  const messagesFn = useServerFn(getSupportThreadMessages);
  const handledFn = useServerFn(setSupportThreadHandled);
  const qc = useQueryClient();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"todas" | "humano" | "pendentes">("todas");
  const [selected, setSelected] = useState<string | null>(null);

  const threads = useQuery({
    queryKey: ["admin", "support", "threads"],
    queryFn: () => listFn(),
    refetchInterval: 30_000,
  });

  const messages = useQuery({
    queryKey: ["admin", "support", "messages", selected],
    queryFn: () => messagesFn({ data: { threadId: selected! } }),
    enabled: !!selected,
  });

  const toggleHandled = useMutation({
    mutationFn: (vars: { threadId: string; handled: boolean }) => handledFn({ data: vars }),
    onSuccess: () => {
      toast.success("Conversa atualizada");
      void qc.invalidateQueries({ queryKey: ["admin", "support", "threads"] });
    },
    onError: () => toast.error("Não foi possível atualizar"),
  });

  const rows = useMemo(() => {
    const all = threads.data ?? [];
    const q = query.trim().toLowerCase();
    return all.filter((t) => {
      if (filter === "humano" && !t.escalated) return false;
      if (filter === "pendentes" && t.handled) return false;
      if (!q) return true;
      return (
        (t.display_name ?? "").toLowerCase().includes(q) ||
        (t.email ?? "").toLowerCase().includes(q) ||
        (t.last_message ?? "").toLowerCase().includes(q)
      );
    });
  }, [threads.data, query, filter]);

  const active: SupportThreadRow | undefined = rows.find((t) => t.id === selected) ??
    (threads.data ?? []).find((t) => t.id === selected);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Headset className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h1 className="font-display text-xl">Mensagens de suporte</h1>
          <p className="text-sm text-muted-foreground">
            Conversas do MM Suporte com os membros. Atualiza automaticamente.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-border bg-surface-1 px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar por nome, email ou mensagem"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {(["todas", "humano", "pendentes"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition",
              filter === f
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f === "todas" ? "Todas" : f === "humano" ? "Passadas para humano" : "Não tratadas"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-surface-1">
          {threads.isLoading && (
            <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> A carregar conversas…
            </p>
          )}
          {!threads.isLoading && rows.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>
          )}
          <ul className="divide-y divide-border">
            {rows.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setSelected(t.id)}
                  className={cn(
                    "flex w-full items-start gap-3 p-3 text-left transition hover:bg-surface-2",
                    selected === t.id && "bg-surface-2",
                  )}
                >
                  <MemberAvatar
                    userId={t.user_id}
                    name={t.display_name}
                    avatarUrl={t.avatar_url}
                    size={36}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {t.display_name ?? t.email ?? "Membro"}
                      </span>
                      {t.escalated && !t.handled && (
                        <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
                          humano
                        </span>
                      )}
                      {t.handled && <Check className="h-3.5 w-3.5 text-primary" />}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {t.last_message ?? "—"}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {when(t.last_message_at)} · {t.message_count} mensagens
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex max-h-[70vh] flex-col rounded-2xl border border-border bg-surface-1">
          {!selected ? (
            <p className="flex flex-1 items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4" /> Escolhe uma conversa para ler.
            </p>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-border p-3">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {active?.display_name ?? "Membro"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{active?.email ?? ""}</p>
                </div>
                <button
                  onClick={() =>
                    toggleHandled.mutate({ threadId: selected, handled: !active?.handled })
                  }
                  disabled={toggleHandled.isPending}
                  className="rounded-full border border-border px-3 py-1.5 text-xs transition hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {active?.handled ? "Marcar como não tratada" : "Marcar como tratada"}
                </button>
              </header>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {messages.isLoading && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> A carregar mensagens…
                  </p>
                )}
                {(messages.data ?? []).map((m) => (
                  <div
                    key={m.id}
                    className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                        m.role === "user"
                          ? "bg-primary/15 text-foreground"
                          : "bg-surface-2 text-foreground",
                      )}
                    >
                      {m.content}
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        {when(m.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
                {!messages.isLoading && (messages.data ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem mensagens guardadas.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
