import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Envia automaticamente o email de certificado emitido para o próprio membro.
 * O certificado é lido com RLS (apenas o dono o vê) e o envio é idempotente
 * por código, pelo que reenvios não duplicam o email.
 */
export const sendCertificateEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => ({ code: String(data?.code ?? "").trim() }))
  .handler(async ({ data, context }) => {
    if (!data.code) return { sent: false as const };

    const { data: row, error } = await context.supabase
      .from("course_certificates" as never)
      .select("code, course_title, member_name, hours")
      .eq("code" as never, data.code as never)
      .maybeSingle();
    if (error || !row) return { sent: false as const };

    const cert = row as unknown as {
      code: string;
      course_title: string;
      member_name: string;
      hours: number | null;
    };

    const email = (context.claims as { email?: string } | null)?.email;
    if (!email) return { sent: false as const };

    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const result = await sendTemplateEmail("certificate-ready", email, {
        idempotencyKey: `certificate-ready-${cert.code}`,
        templateData: {
          memberName: cert.member_name?.split(" ")[0] ?? "",
          courseTitle: cert.course_title,
          code: cert.code,
          hours: Number(cert.hours ?? 0),
        },
      });
      return { sent: result.sent };
    } catch (err) {
      console.error("[certificate-email] falha ao enviar", err);
      return { sent: false as const };
    }
  });
