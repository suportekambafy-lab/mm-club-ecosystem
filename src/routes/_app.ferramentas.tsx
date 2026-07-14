import { createFileRoute } from "@tanstack/react-router";
import {
  Sparkles,
  LayoutTemplate,
  ListChecks,
  Table2,
  Truck,
  MessagesSquare,
  Calculator,
  Library,
  Lock,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "@/components/mm/section-heading";
import { tools, toolCategories } from "@/data/tools";
import { currentUser } from "@/data/user";
import { canAccess } from "@/lib/permissions";

const iconMap: Record<string, LucideIcon> = {
  Sparkles,
  LayoutTemplate,
  ListChecks,
  Table2,
  Truck,
  MessagesSquare,
  Calculator,
  Library,
};

export const Route = createFileRoute("/_app/ferramentas")({
  head: () => ({
    meta: [
      { title: "Ferramentas — MM Club" },
      {
        name: "description",
        content:
          "Biblioteca curada de prompts, templates, checklists, planilhas, fornecedores, scripts e calculadoras.",
      },
    ],
  }),
  component: ToolsPage,
});

function ToolsPage() {
  return (
    <div className="space-y-12">
      <SectionHeading
        eyebrow="Ferramentas"
        title="A tua caixa de ferramentas premium."
        description="Prompts, templates e calculadoras curadas para acelerar o dia-a-dia do empreendedor MM."
      />

      {toolCategories.map((cat) => {
        const items = tools.filter((t) => t.category === cat);
        if (!items.length) return null;
        return (
          <section key={cat} className="space-y-4">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="font-display text-xl text-foreground md:text-2xl">{cat}</h2>
              <span className="text-xs text-muted-foreground">
                {items.length} {items.length === 1 ? "item" : "itens"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((t) => {
                const Icon = iconMap[t.icon] ?? Sparkles;
                const locked = !canAccess(currentUser, t.visibility);
                return (
                  <div
                    key={t.id}
                    className="group relative flex flex-col justify-between gap-4 overflow-hidden rounded-xl bg-surface-1 p-5 ring-1 ring-border transition hover:ring-[color:var(--hairline)]"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-[color:var(--hairline)]">
                        <Icon className="h-4 w-4" />
                      </div>
                      {locked && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
                          <Lock className="h-3 w-3" /> Premium
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-display text-base leading-tight text-foreground">
                        {t.title}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {t.description}
                      </p>
                    </div>
                    <button
                      disabled={locked}
                      className="inline-flex w-max items-center gap-1.5 text-xs font-medium text-primary transition hover:underline disabled:opacity-50"
                    >
                      {locked ? "Requer Premium" : "Abrir"}
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
