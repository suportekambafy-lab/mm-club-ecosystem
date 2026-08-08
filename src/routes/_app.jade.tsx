import { createFileRoute, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { MessageSquare, Plus, Trash2, PanelLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createThread,
  deleteThread,
  listThreads,
  type AiThread,
} from "@/lib/jade-threads.functions";
import { useConfirm } from "@/components/mm/confirm-dialog";

export const Route = createFileRoute("/_app/jade")({
  component: JadeLayout,
});

function JadeLayout() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const activeId = params.threadId;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirm();

  const fetchThreads = useServerFn(listThreads);
  const newThread = useServerFn(createThread);
  const removeThread = useServerFn(deleteThread);

  const threadsQuery = useQuery({
    queryKey: ["ai-threads"],
    queryFn: () => fetchThreads(),
    staleTime: 10_000,
  });
  const threads: AiThread[] = threadsQuery.data ?? [];

  const create = useMutation({
    mutationFn: () => newThread(),
    onSuccess: async (thread) => {
      await queryClient.invalidateQueries({ queryKey: ["ai-threads"] });
      setDrawerOpen(false);
      void navigate({ to: "/jade/$threadId", params: { threadId: thread.id } });
    },
  });

  async function onDelete(id: string) {
    const ok = await confirm({
      title: "Eliminar esta conversa?",
      description: "Esta ação não pode ser desfeita.",
      confirmLabel: "Eliminar",
      destructive: true,
      surface: "mm-inteligente",
      action: "delete-thread",
    });
    if (!ok) return;
    await removeThread({ data: { threadId: id } });
    await queryClient.invalidateQueries({ queryKey: ["ai-threads"] });
    if (activeId === id) void navigate({ to: "/jade", replace: true });
  }

  const list = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Conversas
        </span>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface-1 px-3 text-xs text-foreground transition hover:bg-surface-2 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Nova
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {threadsQuery.isLoading && (
          <p className="px-2 py-3 text-xs text-muted-foreground">A carregar…</p>
        )}
        {!threadsQuery.isLoading && threads.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            Ainda sem conversas. Começa uma nova.
          </p>
        )}
        {threads.map((t) => (
          <div
            key={t.id}
            className={cn(
              "group mb-1 flex items-center gap-1 rounded-xl px-2 transition",
              activeId === t.id ? "bg-surface-2" : "hover:bg-surface-1",
            )}
          >
            <button
              onClick={() => {
                setDrawerOpen(false);
                void navigate({ to: "/jade/$threadId", params: { threadId: t.id } });
              }}
              className="flex min-w-0 flex-1 items-center gap-2 py-2.5 text-left"
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm text-foreground">{t.title}</span>
            </button>
            <button
              onClick={() => void onDelete(t.id)}
              aria-label="Eliminar conversa"
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:text-destructive focus:opacity-100 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </nav>
  );

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 flex overflow-hidden bg-background top-[calc(env(safe-area-inset-top)+4rem)] sm:top-[calc(env(safe-area-inset-top)+4.5rem)] md:top-[calc(env(safe-area-inset-top)+5rem)] lg:left-[var(--mm-sidebar-w,0px)]">
      <aside className="hidden w-64 shrink-0 border-r border-border lg:block">{list}</aside>

      {drawerOpen && (
        <div className="absolute inset-0 z-30 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="relative z-10 h-full w-72 max-w-[85%] border-r border-border bg-background">
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Fechar"
              className="absolute right-2 top-2 rounded-lg p-2 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            {list}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <button
          onClick={() => setDrawerOpen(true)}
          className="absolute left-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-1 text-foreground lg:hidden"
          aria-label="Conversas"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <Outlet />
      </div>
      {dialog}
    </div>
  );
}
