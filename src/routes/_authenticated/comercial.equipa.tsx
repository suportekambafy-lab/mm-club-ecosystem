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
  return <div className="commercial-enter"><div className="mb-10 flex items-center justify-between border-b border-border pb-4 text-xs text-muted-foreground"><span>Comercial / Equipa</span><span>MM Club</span></div><div className="commercial-team-layout"><header className="commercial-team-intro"><p className="mb-5 text-xs font-medium text-commercial-accent">EQUIPA COMERCIAL</p><h1 className="commercial-page-heading">A nossa equipa</h1><p className="mt-5 max-w-xs text-sm leading-7 text-muted-foreground">SDR e closers do MM Club.</p><div className="mt-8 h-px w-12 bg-commercial-accent" /></header><div className="commercial-stagger grid gap-6 sm:grid-cols-2"><TeamProfile />{team.map(member => <article key={member.id} className="commercial-person overflow-hidden rounded-lg border border-border bg-card"><div className="commercial-person-photo flex items-center justify-center overflow-hidden bg-muted">{member.avatar_url ? <img src={member.avatar_url} alt={member.display_name || "Membro da equipa"} className="h-full w-full object-cover" /> : <span className="text-6xl font-semibold text-muted-foreground">{(member.display_name || "M").slice(0, 1)}</span>}</div><div className="p-6"><p className="mb-2 text-xs capitalize text-commercial-accent">{member.role}</p><h2 className="text-lg font-semibold">{member.display_name || "Membro MM"}</h2></div></article>)}</div></div></div>;
}