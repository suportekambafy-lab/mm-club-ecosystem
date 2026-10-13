import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Search = { _ptxn?: string; next?: string };

export const Route = createFileRoute("/pagamento")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    _ptxn: typeof s._ptxn === "string" ? s._ptxn : undefined,
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Pagamento seguro — MM Club" },
      { name: "description", content: "Conclui o pagamento da tua subscrição MM Club em segurança." },
      { property: "og:title", content: "Pagamento seguro — MM Club" },
      { property: "og:description", content: "Conclui o pagamento da tua subscrição MM Club em segurança." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentPage,
});

declare global {
  interface Window {
    Paddle?: any;
  }
}

function safeNext(next: string | undefined): string {
  if (!next) return "/dashboard?checkout=success";
  try {
    const u = new URL(next, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search : "/dashboard?checkout=success";
  } catch {
    return "/dashboard?checkout=success";
  }
}

function PaymentPage() {
  const { _ptxn, next } = Route.useSearch();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!_ptxn) {
      setError("Link de pagamento inválido.");
      return;
    }
    const token = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
    if (!token) {
      setError("Pagamentos indisponíveis de momento.");
      return;
    }
    const successUrl = `${window.location.origin}${safeNext(next)}`;
    const open = () => {
      const P = window.Paddle!;
      P.Environment.set(token.startsWith("test_") ? "sandbox" : "production");
      P.Initialize({
        token,
        eventCallback: (e: { name?: string }) => {
          if (e?.name === "checkout.closed") window.location.href = "/subscricao";
        },
      });
      P.Checkout.open({
        transactionId: _ptxn,
        settings: { locale: "pt", displayMode: "overlay", successUrl },
      });
    };
    if (window.Paddle) return open();
    const s = document.createElement("script");
    s.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    s.onload = open;
    s.onerror = () => setError("Não foi possível carregar o pagamento. Tenta novamente.");
    document.head.appendChild(s);
  }, [_ptxn, next]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      {error ? (
        <div className="space-y-4">
          <p className="text-foreground">{error}</p>
          <a href="/subscricao" className="text-primary underline">
            Voltar à subscrição
          </a>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p>A abrir o pagamento seguro…</p>
        </div>
      )}
    </main>
  );
}
