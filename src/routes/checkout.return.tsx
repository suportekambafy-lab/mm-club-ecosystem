import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, Mail, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getGuestCheckoutStatus } from "@/lib/billing.functions";
import { intendedOfferPath, rememberIntendedPlan } from "@/lib/intended-plan";
import { trackMeta } from "@/lib/meta/pixel";

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
    refetchInterval: (q) => {
      const d = q.state.data;
      if (d && "ready" in d && (d.ready || d.failed)) return false;
      return 3000;
    },
  });

  const ready = Boolean(data && "ready" in data && data.ready);
  const failed = Boolean(data && "failed" in data && data.failed);
  const email = data && "email" in data ? data.email : null;
  const priceSlug = data && "priceSlug" in data ? data.priceSlug : null;
  const planName = data && "planName" in data ? data.planName : null;
  const isTrial = Boolean(data && "isTrial" in data && data.isTrial);
  const accountCreated = Boolean(data && "accountCreated" in data && data.accountCreated);

  // A oferta exata que falhou (ex.: /trial14 vs /vip) — nunca trocamos de oferta.
  const retryPath = intendedOfferPath(
    priceSlug ? { slug: priceSlug, from: isTrial ? "vip" : "checkout", at: Date.now() } : null,
  );

  // Guarda o plano tentado para que qualquer caminho (login, /checkout, /vip)
  // retome exatamente a mesma escolha em vez de mostrar a parede de planos.
  useEffect(() => {
    if (failed && priceSlug) {
      rememberIntendedPlan(priceSlug, isTrial ? "vip" : "checkout");
    }
  }, [failed, priceSlug, isTrial]);

  // Conversão: dispara uma única vez quando a adesão fica confirmada.
  const [conversionSent, setConversionSent] = useState(false);
  useEffect(() => {
    if (!ready || conversionSent) return;
    setConversionSent(true);
    void trackMeta(
      isTrial ? "StartTrial" : "Purchase",
      {
        currency: "EUR",
        content_name: planName ?? priceSlug ?? "MM Club",
        content_ids: priceSlug ? [priceSlug] : undefined,
        content_type: "product",
      },
      { email },
    );
  }, [ready, conversionSent, isTrial, planName, priceSlug, email]);

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
    if (failed) {
      return (
        <div className="mx-auto flex min-h-[80vh] max-w-lg flex-col items-center justify-center px-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-3xl">
            {isTrial
              ? "Não conseguimos validar o cartão"
              : "O pagamento não foi concluído"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {isTrial
              ? "O teu acesso VIP continua reservado. A validação do cartão foi recusada pelo banco — podes tentar outra vez com o mesmo cartão ou com outro."
              : "Não foi cobrado nenhum valor. Podes retomar exatamente o mesmo plano e tentar de novo com outro método de pagamento."}
          </p>
          {planName ? (
            <p className="mt-4 rounded-full border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
              Plano guardado:{" "}
              <span className="font-medium text-foreground">{planName}</span>
            </p>
          ) : null}

          <div className="mt-8 flex flex-col items-center gap-3">
            {isTrial && retryPath ? (
              <Link
                to={retryPath as never}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
              >
                <RotateCcw className="h-4 w-4" />
                Tentar novamente {planName ?? "a oferta"}
              </Link>
            ) : (
              <Link
                to="/checkout"
                search={priceSlug ? { plan: priceSlug } : {}}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
              >
                <RotateCcw className="h-4 w-4" />
                Retomar {planName ?? "o meu plano"}
              </Link>
            )}
            <a
              href="mailto:geral@mmclub.pt"
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Precisas de ajuda? Fala connosco
            </a>
          </div>
        </div>
      );
    }

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
          {ready
            ? accountCreated
              ? "Conta criada"
              : "Acesso ativado"
            : "A confirmar o pagamento"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {ready
            ? accountCreated
              ? `A tua adesão está ativa e criámos a conta ${email}. Enviámos-te um email para definires a palavra-passe.`
              : `A tua adesão está ativa para ${email}. Se ainda não tens palavra-passe, pede o link abaixo.`
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
