import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStudioContext } from "@/lib/studio.functions";
import { StudioShell } from "@/components/mm/studio/studio-shell";
import { StudioContext, type StudioCtx } from "@/lib/studio-context";

export const Route = createFileRoute("/_app/ferramentas/studio")({
  head: () => ({
    meta: [
      { title: "MM Studio — Criativos com IA" },
      { name: "description", content: "Gera imagens e vídeos publicitários profissionais com IA, alinhados com o teu Brand DNA." },
    ],
  }),
  component: StudioLayout,
});

function StudioLayout() {
  const fetchCtx = useServerFn(getStudioContext);
  const qc = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["studio", "context"],
    queryFn: () => fetchCtx({ data: undefined as never }),
    staleTime: 30_000,
  });

  const balance = data?.credits.balance ?? null;
  const ctx: StudioCtx = {
    balance: balance ?? 0,
    brand: (data?.brand as Record<string, unknown> | null) ?? null,
    products: (data?.products as Array<Record<string, unknown>>) ?? [],
    refresh: () => {
      qc.invalidateQueries({ queryKey: ["studio"] });
    },
  };

  return (
    <StudioShell balance={balance}>
      {isPending ? (
        <div className="space-y-12">
          <section className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-3xl" />
            ))}
          </section>
          <CardGridSkeleton cards={4} className="grid gap-4 md:grid-cols-2" />
          <CardGridSkeleton cards={6} className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6" />
        </div>
      ) : (
        <StudioContext.Provider value={ctx}>
          <Outlet />
        </StudioContext.Provider>
      )}
    </StudioShell>
  );
}


