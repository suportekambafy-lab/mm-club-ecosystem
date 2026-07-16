import { createFileRoute } from "@tanstack/react-router";
import { Wand2 } from "lucide-react";
import { SectionHeading } from "@/components/mm/section-heading";

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
    <div className="space-y-10">
      <SectionHeading
        eyebrow="Ferramentas"
        title="A tua caixa de ferramentas premium."
        description="Prompts, templates e calculadoras curadas para acelerar o dia-a-dia do empreendedor MM."
      />

      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-surface-1 px-6 py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-[color:var(--hairline)]">
          <Wand2 className="h-5 w-5" />
        </div>
        <h2 className="font-display text-xl text-foreground md:text-2xl">Em breve</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          As ferramentas do MM Club serão disponibilizadas em breve aqui.
        </p>
      </div>
    </div>
  );
}
