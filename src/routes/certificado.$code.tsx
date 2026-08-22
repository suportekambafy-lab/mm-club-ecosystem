import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, ShieldQuestion } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Verified = {
  member_name: string;
  course_title: string;
  hours: number;
  issued_at: string;
};

export const Route = createFileRoute("/certificado/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Certificado ${params.code} — MM Club` },
      {
        name: "description",
        content: "Verificação pública de certificados de conclusão do MM Club.",
      },
      { property: "og:title", content: `Certificado ${params.code} — MM Club` },
      {
        property: "og:description",
        content: "Verificação pública de certificados de conclusão do MM Club.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CertificatePage,
});

function CertificatePage() {
  const { code } = Route.useParams();
  const [state, setState] = useState<"loading" | "ok" | "invalid">("loading");
  const [cert, setCert] = useState<Verified | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await (supabase as unknown as {
          rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: Verified[] | null; error: unknown }>;
        }).rpc("verify_certificate", { _code: code });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : null;
        if (cancelled) return;
        setCert(row ?? null);
        setState(row ? "ok" : "invalid");
      } catch {
        if (!cancelled) setState("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-xl rounded-3xl border border-border bg-surface-1 p-6 text-center sm:p-10">
        <p className="font-display text-[11px] uppercase tracking-[0.32em] text-primary">MM Club</p>

        {state === "loading" && (
          <p className="mt-8 text-sm text-muted-foreground">A verificar certificado…</p>
        )}

        {state === "invalid" && (
          <>
            <ShieldQuestion className="mx-auto mt-6 h-10 w-10 text-muted-foreground" />
            <h1 className="mt-4 font-display text-2xl text-foreground">Certificado não encontrado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              O código <span className="font-mono text-foreground">{code}</span> não corresponde a nenhum
              certificado emitido.
            </p>
          </>
        )}

        {state === "ok" && cert && (
          <>
            <BadgeCheck className="mx-auto mt-6 h-10 w-10 text-primary" />
            <h1 className="mt-4 font-display text-3xl leading-tight text-foreground">{cert.member_name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">concluiu com êxito o programa</p>
            <p className="mt-3 font-display text-xl text-primary">{cert.course_title}</p>
            <p className="mt-4 text-xs text-muted-foreground">
              {Number(cert.hours) > 0 ? `${Number(cert.hours).toFixed(0)}h de formação · ` : ""}
              Emitido a{" "}
              {new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "long", year: "numeric" }).format(
                new Date(cert.issued_at),
              )}
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">{code}</p>
          </>
        )}

        <Link
          to="/"
          className="mt-8 inline-flex h-10 items-center rounded-full bg-surface-2 px-5 text-xs font-medium text-foreground transition hover:bg-surface-3"
        >
          Voltar ao MM Club
        </Link>
      </div>
    </main>
  );
}
