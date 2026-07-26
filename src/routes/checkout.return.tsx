import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getGuestCheckoutStatus } from "@/lib/billing.functions";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { session_id?: string; intent?: string } => ({
    session_id:
      typeof search.session_id === "string" ? search.session_id : undefined,
    intent: typeof search.intent === "string" ? search.intent : undefined,
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
  const { session_id, intent } = Route.useSearch();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["guest-checkout", intent],
    queryFn: () => getGuestCheckoutStatus({ data: { intentId: intent! } }),
    enabled: Boolean(intent),
    refetchInterval: (q) =>
      q.state.data && "ready" in q.state.data && q.state.data.ready
        ? false
        : 3000,
  });

  const ready = Boolean(data && "ready" in data && data.ready);
  const email = data && "email" in data ? data.email : null;

  const sendSetPassword = async () => {
    if (!email) return;
    setSending(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setSending(false);
    setSent(true);
  };

  if (intent) {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-lg flex-col items-center justify-center px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          {ready ? (
            <CheckCircle2 className="h-8 w-8" />
          ) : (
            <Loader2 className="h-8 w-8 animate-spin" />
          )}
        </div>
        <h1 className="mt-6 font-display text-3xl">
          {ready ? "Conta criada" : "A confirmar o pagamento"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {ready
            ? `A tua adesão está ativa e criámos a conta ${email}. Enviámos-te um email para definires a palavra-passe.`
            : isLoading
              ? "A verificar o estado do pagamento..."
              : "Assim que o pagamento for confirmado criamos a tua conta automaticamente. Isto costuma demorar alguns segundos."}
        </p>

        {ready ? (
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={sendSetPassword}
              disabled={sending || sent}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              <Mail className="h-4 w-4" />
              {sent
                ? "Email enviado"
                : sending
                  ? "A enviar..."
                  : "Reenviar link de palavra-passe"}
            </button>
            <Link
              to="/auth"
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Já defini a palavra-passe — entrar
            </Link>
          </div>
        ) : null}
      </div>
    );
  }

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
