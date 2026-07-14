import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Bell, Users, ArrowUpRight, Send } from "lucide-react";
import { SectionHeading } from "@/components/mm/section-heading";
import { communityNotices, featuredMembers } from "@/data/community";

export const Route = createFileRoute("/_app/comunidade")({
  head: () => ({
    meta: [
      { title: "Comunidade — MM Club" },
      {
        name: "description",
        content:
          "O grupo privado da Marca Milionária. Networking, avisos e conversas com empreendedores como tu.",
      },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  return (
    <div className="space-y-12">
      <SectionHeading
        eyebrow="Comunidade"
        title="Não estás sozinho."
        description="Empreendedores como tu, no mesmo caminho. Grupo privado, avisos e networking real."
      />

      <section className="grid gap-6 rounded-2xl bg-surface-1 p-6 ring-1 ring-border md:grid-cols-[1fr_auto] md:items-center md:p-8">
        <div className="flex items-start gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-[color:var(--hairline)]">
            <MessageCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-primary">
              Grupo privado
            </p>
            <h2 className="mt-2 font-display text-2xl text-foreground">WhatsApp MM Club</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Conversa diária, avisos de lives, oportunidades e networking com membros ativos.
            </p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-gold-soft">
          Entrar no grupo <Send className="h-4 w-4" />
        </button>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-surface-1 p-6 ring-1 ring-border">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg text-foreground">Avisos recentes</h3>
          </div>
          <ul className="mt-5 space-y-4">
            {communityNotices.map((n) => (
              <li key={n.id} className="border-b border-border/50 pb-4 last:border-b-0 last:pb-0">
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-primary">{n.timeAgo}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl bg-surface-1 p-6 ring-1 ring-border">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg text-foreground">Networking</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Membros em destaque esta semana.</p>
          <ul className="mt-5 space-y-3">
            {featuredMembers.map((m) => (
              <li
                key={m.name}
                className="flex items-center gap-3 rounded-lg bg-surface-2/60 p-3 ring-1 ring-border"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                  {m.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.role}</p>
                </div>
                <button aria-label="Conectar" className="text-muted-foreground transition hover:text-primary">
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-border p-8 text-center">
        <h3 className="font-display text-lg text-foreground">
          Em breve: fórum privado dentro do MM Club
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Threads por tópico, respostas do fundador e biblioteca de discussões.
        </p>
      </section>
    </div>
  );
}
