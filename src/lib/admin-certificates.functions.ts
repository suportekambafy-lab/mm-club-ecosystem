/**
 * Admin Certificados & Sequências — gated on the `admin` role.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CertificatesOverview } from "@/lib/admin/certificates.server";

export const getCertificatesOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CertificatesOverview> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { collectCertificatesOverview } = await import("@/lib/admin/certificates.server");
    return collectCertificatesOverview();
  });

export const previewCertificatePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { memberName?: string; courseTitle?: string; hours?: number }) => ({
    memberName: String(data?.memberName ?? "").trim() || "Nome do Membro",
    courseTitle: String(data?.courseTitle ?? "").trim() || "Programa MM Club",
    hours: Number(data?.hours ?? 8),
  }))
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { renderCertificatePdf } = await import("@/lib/certificates.server");
    const bytes = await renderCertificatePdf({
      code: "MMC-PREVIEW",
      course_title: data.courseTitle,
      member_name: data.memberName,
      hours: data.hours,
      issued_at: new Date().toISOString(),
    });
    return { base64: Buffer.from(bytes).toString("base64") };
  });

export const getCertificatePdfByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => ({ code: String(data?.code ?? "").trim() }))
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    if (!data.code) throw new Error("Código inválido");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("course_certificates")
      .select("code, course_title, member_name, hours, issued_at")
      .eq("code", data.code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Certificado não encontrado");
    const { renderCertificatePdf } = await import("@/lib/certificates.server");
    const bytes = await renderCertificatePdf(row as never);
    return { fileName: `Certificado-${data.code}.pdf`, base64: Buffer.from(bytes).toString("base64") };
  });
