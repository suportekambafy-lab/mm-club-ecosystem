import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { createThread, listThreads } from "@/lib/jade-threads.functions";

export const Route = createFileRoute("/_app/jade/")({
  head: () => ({
    meta: [
      { title: "MM Inteligente — MM Club" },
      {
        name: "description",
        content:
          "MM Inteligente do MM Club: pergunta sobre marca, marketing, vendas, escala e liderança.",
      },
      { property: "og:title", content: "MM Inteligente — MM Club" },
      {
        property: "og:description",
        content: "O assistente do MM Club, com todas as tuas conversas guardadas na conta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JadeIndex,
});

function JadeIndex() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchThreads = useServerFn(listThreads);
  const newThread = useServerFn(createThread);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const threads = await fetchThreads();
        const target = threads[0] ?? (await newThread());
        await queryClient.invalidateQueries({ queryKey: ["ai-threads"] });
        void navigate({
          to: "/jade/$threadId",
          params: { threadId: target.id },
          replace: true,
        });
      } catch {
        started.current = false;
      }
    })();
  }, [fetchThreads, newThread, navigate, queryClient]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}
