import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { coursesById } from "@/data/courses";
import { useClubProducts } from "@/hooks/use-club-products";
import { productOfCourse } from "@/lib/club/products";
import { ProductPaywall } from "@/components/mm/product-paywall";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/academia/$courseId")({
  loader: ({ params }) => {
    const course = coursesById[params.courseId];
    if (!course) throw notFound();
    return { course };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.course.title} — MM Club` },
          { name: "description", content: loaderData.course.tagline },
        ]
      : [{ title: "Curso — MM Club" }],
  }),
  component: CourseGate,
});

function CourseGate() {
  const { course } = Route.useLoaderData();
  const { ready, courseUnlocked } = useClubProducts();
  if (!ready) return <Skeleton className="h-96 w-full rounded-3xl" />;
  if (!courseUnlocked(course)) return <ProductPaywall productId={productOfCourse(course)} courseTitle={course.title} />;
  return <Outlet />;
}
