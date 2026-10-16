import { createFileRoute } from "@tanstack/react-router";
import { AplicacoesPage } from "@/components/admin/applications-page";
export const Route = createFileRoute("/admin/aplicacoes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Aplicações — MM Admin" },
      { name: "description", content: "Leads da página de aplicação, classificação, calls marcadas e horários." },
      { property: "og:title", content: "Aplicações — MM Admin" },
      { property: "og:description", content: "Painel de leads da aplicação MM Club." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AplicacoesPage,
});

