import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id:
      typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Pagamento concluído — MM Club" },
      { name: "description", content: "Obrigado pela tua adesão ao MM Club." },
    ],
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h1 className="mt-6 font-display text-3xl">Pagamento concluído</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {session_id
          ? "A tua adesão está a ser ativada. Podes aceder ao MM Club de imediato."
          : "Não encontrámos informação da sessão. Se o pagamento foi cobrado, contacta-nos."}
      </p>
      <Link
        to="/dashboard"
        className="mt-8 inline-flex items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background hover:opacity-90"
      >
        Ir para o Dashboard
      </Link>
    </div>
  );
}
