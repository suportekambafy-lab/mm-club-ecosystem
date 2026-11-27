import { createFileRoute } from "@tanstack/react-router";
import { ServiceRequestsView } from "@/components/shared/service-requests-view";
export const Route = createFileRoute("/_authenticated/comercial/servicos")({
  head: () => ({ meta: [{ title: "Serviços individuais — Comercial MM Club" }, { name: "description", content: "Pedidos de serviços individuais dos membros." }, { property: "og:title", content: "Serviços individuais — Comercial MM Club" }, { property: "og:description", content: "Pedidos de serviços individuais." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: () => <ServiceRequestsView commercial />,
});
