import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
});

function toUIMessages(rows: AiMessageRow[]): UIMessage[] {
  return rows.map((r) => ({
    id: r.client_id ?? r.id,
    role: r.role,
    parts: (Array.isArray(r.parts) ? r.parts : []).map((p) => ({
      type: "text" as const,
      text: p.text ?? "",
    })),
  })) as UIMessage[];
}

function JadeThreadPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchThread = useServerFn(getThread);

  const query = useQuery({
    queryKey: ["ai-thread", threadId],
    queryFn: () => fetchThread({ data: { threadId } }),
    staleTime: Infinity,
    gcTime: 0,
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

  if (query.isLoading || !query.data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
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
