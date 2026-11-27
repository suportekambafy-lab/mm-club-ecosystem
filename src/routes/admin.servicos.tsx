import { createFileRoute } from "@tanstack/react-router";
import { ServiceRequestsView } from "@/components/shared/service-requests-view";
export const Route = createFileRoute("/admin/servicos")({
  ssr: false,
  head: () => ({ meta: [{ title: "Serviços individuais — Administração MM Club" }, { name: "description", content: "Pedidos de serviços individuais dos membros." }, { property: "og:title", content: "Serviços individuais — Administração MM Club" }, { property: "og:description", content: "Pedidos de serviços individuais." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: ServiceRequestsView,
});
