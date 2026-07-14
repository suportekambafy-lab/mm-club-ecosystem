import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { coursesById } from "@/data/courses";

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
  component: () => <Outlet />,
});
