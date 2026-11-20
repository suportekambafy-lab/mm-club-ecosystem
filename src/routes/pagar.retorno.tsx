import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { resolveVivaReturn } from "@/lib/mmpay.functions";

export const Route = createFileRoute("/pagar/retorno")({
  validateSearch: (s: Record<string, unknown>) => ({
    s: typeof s.s === "string" ? s.s : typeof s.s === "number" ? String(s.s) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "A confirmar pagamento — MM Club" },
      { name: "description", content: "A confirmar o teu pagamento MM Club." },
      { property: "og:title", content: "A confirmar pagamento — MM Club" },
      { property: "og:description", content: "A confirmar o teu pagamento MM Club." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VivaReturn,
});

function VivaReturn() {
  const { s } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!s || !/^[0-9]{8,24}$/.test(s)) return setError(true);
    resolveVivaReturn({ data: { orderCode: s } })
      .then((r) => {
        if (r.redirect) {
          window.location.replace(r.redirect);
          return;
        }
        if (!r.code) return setError(true);
        navigate({ to: "/pagar/$code", params: { code: r.code }, search: { session_id: `vvo_${s}` }, replace: true });
      })
      .catch(() => setError(true));
  }, [s, navigate]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      {error ? (
        <p className="text-foreground">Não encontrámos este pagamento. Se foi cobrado, contacta-nos.</p>
      ) : (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p>A confirmar o pagamento…</p>
        </div>
      )}
    </main>
  );
}
