import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { courses } from "@/data/courses";
import { certificateCurriculum } from "./certificate-curriculum";

export async function issueCertificateForMember(userId: string, courseId: string) {
  const existing = await supabaseAdmin.from("course_certificates").select("code,issued_at,member_name").eq("user_id", userId).eq("course_id", courseId).maybeSingle();
  if (existing.error) throw new Error("Certificado indisponível.");
  if (existing.data) return existing.data;
  const { data: allowed, error: accessError } = await supabaseAdmin.rpc("is_academy_viewer", { _user_id: userId });
  if (accessError || !allowed) throw new Error("Acesso não autorizado.");
  const { data: row, error } = await supabaseAdmin.from("admin_overrides").select("data").eq("id", "courses").maybeSingle();
  if (error) throw new Error("Catálogo indisponível.");
  const curriculum = certificateCurriculum(courses, row?.data, courseId);
  if (curriculum.releaseAt && new Date(curriculum.releaseAt).getTime() > Date.now()) throw new Error("Curso ainda indisponível.");
  const rpc = supabaseAdmin as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: Array<{ code: string; issued_at: string; member_name: string }> | null; error: unknown }>;
  };
  const result = await rpc.rpc("issue_course_certificate_internal", {
    _user_id: userId, _course_id: courseId, _course_title: curriculum.title, _hours: curriculum.hours, _lesson_ids: curriculum.lessonIds,
  });
  const certificate = result.data?.[0];
  if (result.error || !certificate) throw new Error("Conclui todas as aulas antes de emitir o certificado.");
  return certificate;
}