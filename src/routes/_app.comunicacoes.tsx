import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, MailWarning } from "lucide-react";
import { getMyCommunications } from "@/lib/comms.functions";
import { CATEGORY_LABEL } from "@/lib/notifications/catalog";
import type { TemplateCategory } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/comunicacoes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "As minhas comunicações — MM Club" },
      {
        name: "description",
        content:
          "Histórico de todos os emails que o MM Club te enviou: conta, subscrição, faturação e segurança.",
      },
      { property: "og:title", content: "As minhas comunicações — MM Club" },
      {
        property: "og:description",
        content:
          "Consulta todos os emails enviados pela tua conta MM Club, com data, assunto e estado de envio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyComms,
});

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function MyComms() {
  const load = useServerFn(getMyCommunications);
  const { data, isLoading } = useQuery({
    queryKey: ["my-communications"],
    queryFn: () => load({ data: undefined }),
    staleTime: 30_000,
  });

  const rows = (data ?? []).filter((r) => r.status !== "skipped");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <header>
        <h1 className="font-display text-2xl font-semibold">As minhas comunicações</h1>
        <p className="text-sm text-muted-foreground">
          Todos os emails que te enviámos. Se algum não chegou à tua caixa de entrada,
          consegues ver aqui o que foi enviado e quando.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/40 p-8 text-center">
          <Mail className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Ainda não recebeste nenhum email nosso.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-border bg-card/40 p-4 transition hover:border-primary/50"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    row.status === "error"
                      ? "bg-red-400/10 text-red-400"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {row.status === "error" ? (
                    <MailWarning className="h-4 w-4" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{row.subject}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {CATEGORY_LABEL[row.category as TemplateCategory] ?? row.category} ·{" "}
                    {fmt(row.createdAt)} · {row.recipient}
                  </p>
                  {row.status === "error" ? (
                    <p className="mt-1 text-xs text-red-400">
                      Não conseguimos entregar este email.
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
