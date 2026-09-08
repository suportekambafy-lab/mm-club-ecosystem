/**
 * Registo (silencioso) das vistas e cliques no convite de parceiro Shopify.
 * Alimenta a página do admin "Parcerias & Créditos".
 */
import { trackPartnerLink } from "@/lib/partner-links.functions";

export type PartnerContext = {
  courseId?: string | null;
  courseTitle?: string | null;
  moduleId?: string | null;
  moduleTitle?: string | null;
  lessonId?: string | null;
  lessonTitle?: string | null;
};

/** Nunca deve interromper a experiência do membro — falhas são ignoradas. */
export function logPartnerEvent(
  kind: "impression" | "click",
  placement: string,
  ctx: PartnerContext = {},
) {
  try {
    void trackPartnerLink({ data: { kind, placement, ...ctx } }).catch(() => {});
  } catch {
    /* offline ou sem sessão */
  }
}
