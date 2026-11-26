import { useMemo } from "react";
import { courses as allCourses } from "@/data/courses";
import { useCourseAccess } from "@/hooks/use-course-release";
import { useUserProgress } from "@/hooks/use-user-progress";
import { computeNextStep, type NextStep } from "@/lib/next-step";
import { useActiveProduct } from "@/hooks/use-active-product";
import { productOfCourse } from "@/lib/club/products";

/**
 * O trilho guiado do produto ativo: a aula exata a ver a seguir.
 * Um único sítio para a página não ter de calcular o mesmo duas vezes.
 */
export function useNextStep(): { step: NextStep | null; loaded: boolean } {
  const { progress, loaded } = useUserProgress();
  const { canOpen } = useCourseAccess();
  const [active] = useActiveProduct();

  const open = useMemo(
    () => allCourses.filter((c) => canOpen(c) && productOfCourse(c) === active),
    [canOpen, active],
  );
  const step = useMemo(
    () => (loaded ? computeNextStep(open, progress) : null),
    [loaded, open, progress],
  );

  return { step, loaded };
}
