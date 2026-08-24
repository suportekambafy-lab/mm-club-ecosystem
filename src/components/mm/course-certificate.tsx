import { useCallback, useEffect, useState } from "react";
import { Award, Download, Loader2, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCertificatePdf } from "@/lib/certificates.functions";
import { sendCertificateEmail } from "@/lib/certificate-email.functions";
import { cn } from "@/lib/utils";

type Certificate = { code: string; issued_at: string; member_name: string };

/**
 * Certificado de conclusão: aparece quando o curso está 100% concluído.
 * Emite uma vez (idempotente na base de dados) e permite descarregar/partilhar.
 */
export function CourseCertificate({
  courseId,
  courseTitle,
  hours,
  lessonsTotal,
  completed,
  lessonsDone,
  className,
}: {
  courseId: string;
  courseTitle: string;
  hours: number;
  lessonsTotal: number;
  completed: boolean;
  /** Aulas já concluídas — mostra o quanto falta para o certificado. */
  lessonsDone?: number;
  className?: string;
}) {
  const [cert, setCert] = useState<Certificate | null>(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (!cancelled) setChecked(true);
        return;
      }
      const { data } = await (supabase as unknown as { from: (t: string) => any })
        .from("course_certificates")
        .select("code, issued_at, member_name")
        .eq("course_id", courseId)
        .maybeSingle();
      if (cancelled) return;
      setCert((data as Certificate) ?? null);
      setChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const issue = useCallback(async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: Certificate[] | null; error: unknown }>;
      }).rpc("issue_course_certificate", {
        _course_id: courseId,
        _course_title: courseTitle,
        _hours: hours,
        _lessons_total: lessonsTotal,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : null;
      if (row) {
        setCert(row);
        void sendCertificateEmail({ data: { code: row.code } }).catch(() => {});
      }
    } catch (error) {
      console.warn("Falha ao emitir certificado", error);
    } finally {
      setBusy(false);
    }
  }, [courseId, courseTitle, hours, lessonsTotal]);

  const download = useCallback(async () => {
    if (!cert) return;
    setBusy(true);
    try {
      const res = await getCertificatePdf({ data: { code: cert.code } });
      const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn("Falha ao descarregar certificado", error);
    } finally {
      setBusy(false);
    }
  }, [cert]);

  const share = useCallback(async () => {
    if (!cert) return;
    const url = `${window.location.origin}/certificado/${cert.code}`;
    const text = `Concluí o programa ${courseTitle} no MM Club.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Certificado MM Club", text, url });
        return;
      } catch {
        /* utilizador cancelou */
      }
    }
    await navigator.clipboard?.writeText(url).catch(() => {});
  }, [cert, courseTitle]);

  if (!checked || (!completed && !cert)) return null;

  return (
    <section
      className={cn(
        "rounded-3xl border border-primary/30 bg-primary/[0.06] p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Award className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base text-foreground">
            {cert ? "Certificado de conclusão" : "Curso concluído — emite o teu certificado"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {cert
              ? `Código ${cert.code} · verificável em /certificado/${cert.code}`
              : "Certificado oficial MM Club, com código público de verificação."}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {!cert ? (
              <button
                type="button"
                onClick={issue}
                disabled={busy}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition hover:bg-gold-soft disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Award className="h-3.5 w-3.5" />}
                Emitir certificado
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={download}
                  disabled={busy}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition hover:bg-gold-soft disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Descarregar PDF
                </button>
                <button
                  type="button"
                  onClick={share}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-surface-2 px-4 text-xs font-medium text-foreground transition hover:bg-surface-3"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Partilhar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
