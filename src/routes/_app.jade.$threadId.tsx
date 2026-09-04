import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo } from "react";
import type { UIMessage } from "ai";
import { getThread, type AiMessageRow } from "@/lib/jade-threads.functions";
import { JadeChat } from "@/components/mm/jade-chat";
import { JadeChatSkeleton } from "@/components/mm/jade-skeleton";


export const Route = createFileRoute("/_app/jade/$threadId")({
  head: () => ({
    meta: [
      { title: "Conversa — MM Inteligence | MM Club" },
      {
        name: "description",
        content:
          "Retoma a tua conversa com o MM Inteligence: marca, marketing, vendas, escala e liderança.",
      },
      { property: "og:title", content: "Conversa — MM Inteligence | MM Club" },
      {
        property: "og:description",
        content: "As tuas conversas com o MM Inteligence, guardadas na tua conta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JadeThreadPage,
  errorComponent: JadeThreadError,
});

function JadeThreadError() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-xl text-foreground">Não foi possível abrir esta conversa</h1>
      <p className="text-sm text-muted-foreground">
        Tenta novamente ou começa uma conversa nova.
      </p>
      <Link
        to="/jade"
        className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-soft"
      >
        Voltar ao MM Inteligence
      </Link>
    </div>
  );
}

function toUIMessages(rows: AiMessageRow[]): UIMessage[] {
  const seen = new Set<string>();
  const out: UIMessage[] = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const id = r.client_id || r.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      role: r.role === "user" || r.role === "assistant" || r.role === "system" ? r.role : "assistant",
      parts: (Array.isArray(r.parts) ? r.parts : []).map((p) => ({
        type: "text" as const,
        text: typeof p?.text === "string" ? p.text : "",
      })),
    } as UIMessage);
  }
  return out;
}

function JadeThreadPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchThread = useServerFn(getThread);

  const query = useQuery({
    queryKey: ["ai-thread", threadId],
    queryFn: () => fetchThread({ data: { threadId } }),
    staleTime: 60_000,
    gcTime: 30 * 60_000,
  });

  useEffect(() => {
    if (query.isSuccess && query.data === null) {
      void navigate({ to: "/jade", replace: true });
    }
  }, [query.isSuccess, query.data, navigate]);

  const initialMessages = useMemo(
    () => (query.data ? toUIMessages(query.data.messages) : []),
    [query.data],
  );

  const onTitleChanged = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["ai-threads"] });
  }, [queryClient]);

  if (!query.data) {
    return <JadeChatSkeleton />;
  }


  return (
    <JadeChat
      key={threadId}
      threadId={threadId}
      initialMessages={initialMessages}
      onTitleChanged={onTitleChanged}
    />
  );
}
