import { useMemo } from "react";
import { courses, isCourseReleased } from "@/data/courses";
import { useAdminOverridesVersion } from "@/hooks/use-admin-overrides";
import { useTicker } from "@/hooks/use-ticker";

export const LEGACY_COURSE_ID = "marca-milionaria-legacy";

/**
 * Estado de lançamento do "Marca Milionária Legacy" para os banners:
 * antes da hora mostra a estreia agendada, depois muda para "já disponível".
 * Reavalia ao segundo e reage às edições do admin (releaseAt).
 */
export function useLegacyLaunch() {
  const version = useAdminOverridesVersion();
  const now = useTicker(1000);

  return useMemo(() => {
    void version;
    const course = courses.find((c) => c.id === LEGACY_COURSE_ID);
    const released = course ? isCourseReleased(course, new Date(now)) : false;
    const startsAt = course?.releaseAt ? new Date(course.releaseAt) : null;
    const dateLabel =
      startsAt && !Number.isNaN(startsAt.getTime())
        ? `${startsAt.toLocaleDateString("pt-PT", {
            day: "numeric",
            month: "long",
            timeZone: "Europe/Lisbon",
          })} · ${startsAt.toLocaleTimeString("pt-PT", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Lisbon",
          })}`
        : null;

    return {
      course,
      released,
      dateLabel,
      eyebrow: released
        ? "Já disponível · Marca Milionária Legacy"
        : "Novo curso · Marca Milionária Legacy",
      headline: released
        ? "Já disponível — começa agora"
        : dateLabel
          ? `Estreia ${dateLabel} (Lisboa)`
          : "Estreia em breve",
      badge: released ? "Novo" : "Em breve",
      cta: released ? "Começar agora" : "Ver contador",
    };
  }, [version, now]);
}
