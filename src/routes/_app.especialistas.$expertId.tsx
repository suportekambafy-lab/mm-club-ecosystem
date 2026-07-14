import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { expertsById } from "@/data/experts";
import { courses } from "@/data/courses";
import { CourseCard } from "@/components/mm/course-card";

export const Route = createFileRoute("/_app/especialistas/$expertId")({
  loader: ({ params }) => {
    const expert = expertsById[params.expertId];
    if (!expert) throw notFound();
    return { expert };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.expert.name} — MM Club` },
          { name: "description", content: loaderData.expert.shortBio },
        ]
      : [{ title: "Especialista — MM Club" }],
  }),
  component: ExpertPage,
});

function ExpertPage() {
  const { expert } = Route.useLoaderData();
  const expertCourses = courses.filter((c) => c.expertId === expert.id);

  return (
    <div className="space-y-10">
      <Link
        to="/academia"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Academia
      </Link>

      <section className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-end">
        <div
          className="h-48 w-48 rounded-2xl ring-1 ring-[color:var(--hairline)]"
          style={{ background: expert.photo }}
        />
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">
            Especialista MM Club
          </p>
          <h1 className="font-display text-4xl leading-tight text-foreground md:text-5xl">
            {expert.name}
          </h1>
          <p className="text-base text-muted-foreground">{expert.role}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {expert.expertise.map((tag: string) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-surface-1 px-3 py-1 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-3xl">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {expert.longBio}
        </p>
      </section>

      {expertCourses.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl text-foreground md:text-2xl">
            Cursos com {expert.name.split(" ")[0]}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {expertCourses.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
