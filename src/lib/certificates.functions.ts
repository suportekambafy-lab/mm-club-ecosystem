import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Gera o PDF do certificado de conclusão. O certificado só é devolvido ao
 * membro a quem pertence (RLS garante o filtro por auth.uid()).
 */
export const getCertificatePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => ({ code: String(data?.code ?? "").trim() }))
  .handler(async ({ data, context }) => {
    if (!data.code) throw new Error("Código inválido");
    const { data: row, error } = await context.supabase
      .from("course_certificates" as never)
      .select("code, course_title, member_name, hours, issued_at")
      .eq("code" as never, data.code as never)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Certificado não encontrado");

    const cert = row as unknown as {
      code: string;
      course_title: string;
      member_name: string;
      hours: number;
      issued_at: string;
    };

    const { renderCertificatePdf } = await import("./certificates.server");
    const bytes = await renderCertificatePdf(cert);
    return {
      fileName: `Certificado-${cert.code}.pdf`,
      base64: Buffer.from(bytes).toString("base64"),
    };
  });
