/**
 * Aviso do Código do Clube: mostra ao membro sancionado o motivo, o prazo e o
 * caminho correto (suporte) para tratar de pagamentos, faturas ou acessos.
 */
import { useQuery } from "@tanstack/react-query";
import { Gavel, LifeBuoy } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

export type ActiveSanction = {
  kind: string;
  level: number;
  reason: string;
  rule: string | null;
  expires_at: string | null;
  permanent: boolean;
};

export function useActiveSanction() {
  return useQuery({
    queryKey: ["community", "sanction"],
    staleTime: 60_000,
    queryFn: async (): Promise<ActiveSanction | null> => {
      const { data, error } = await (supabase as any).rpc("my_community_sanction");
      if (error) return null;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as ActiveSanction | undefined) ?? null;
    },
  });
}

export function SanctionBanner({ sanction }: { sanction: ActiveSanction }) {
  const until = sanction.permanent
    ? null
    : sanction.expires_at
      ? formatDistanceToNow(new Date(sanction.expires_at), { locale: pt, addSuffix: true })
      : null;

  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
      <div className="flex items-start gap-3">
        <Gavel className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 space-y-2">
          <p className="font-display text-sm tracking-wide text-destructive">
            {sanction.permanent
              ? "Acesso à comunidade removido"
              : `Sem poder interagir na comunidade${until ? ` — reativa ${until}` : ""}`}
          </p>
          <p className="text-sm text-muted-foreground">{sanction.reason}</p>
          {sanction.rule ? (
            <p className="text-xs text-muted-foreground/80">Regra: {sanction.rule}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              to="/codigo"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
            >
              Ver Código do Clube
            </Link>
            <a
              href="mailto:suporte@mmclub.online"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
            >
              <LifeBuoy className="h-3.5 w-3.5" /> Falar com o suporte
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
