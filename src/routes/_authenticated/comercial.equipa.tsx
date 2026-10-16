import { createFileRoute } from "@tanstack/react-router";
import { TeamProfile } from "@/components/commercial/team-profile";
import { useSuspenseQuery } from "@tanstack/react-query";
import { commercialMembersOptions } from "@/lib/commercial/queries";

export const Route = createFileRoute("/_authenticated/comercial/equipa")({
  loader: ({ context }) => context.queryClient.ensureQueryData(commercialMembersOptions),
  head: () => ({ meta: [{ title: "Equipa — Comercial MM Club" }, { name: "description", content: "Conhece a equipa SDR e Closer do MM Club, incluindo Guadalupe Costa." }, { property: "og:title", content: "Equipa — Comercial MM Club" }, { property: "og:description", content: "As pessoas da equipa comercial MM Club." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: CommercialTeam,
});

function CommercialTeam() {
  const { data } = useSuspenseQuery(commercialMembersOptions);
  const team = data.filter(member => member.role && !member.display_name?.toLocaleLowerCase().includes("guadalupe"));
  return <div className="commercial-enter"><header className="mb-8 border-b border-border pb-8"><p className="mb-3 text-xs text-commercial-gold">MM TEAM</p><h1 className="text-4xl font-semibold">A nossa equipa<span className="text-commercial-gold">.</span></h1><p className="mt-4 text-sm text-muted-foreground">Pessoas que abrem portas e aproximam oportunidades.</p></header><div className="commercial-stagger grid max-w-5xl gap-6 sm:grid-cols-2 xl:grid-cols-3"><TeamProfile />{team.map(member => <article key={member.id} className="overflow-hidden rounded-lg border border-border bg-card"><div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted">{member.avatar_url ? <img src={member.avatar_url} alt={member.display_name || "Membro da equipa"} className="h-full w-full object-cover" /> : <span className="text-6xl font-semibold text-commercial-gold">{(member.display_name || "M").slice(0, 1)}</span>}</div><div className="p-5"><p className="mb-1 text-xs uppercase text-commercial-gold">{member.role}</p><h2 className="text-xl font-semibold">{member.display_name || "Membro MM"}</h2></div></article>)}</div></div>;
}