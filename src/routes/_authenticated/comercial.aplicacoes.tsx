import { createFileRoute } from "@tanstack/react-router";
import { AplicacoesPage } from "@/components/admin/applications-page";
import { PageSkeleton } from "@/components/ui/page-skeleton";
export const Route = createFileRoute("/_authenticated/comercial/aplicacoes")({
  head:()=>({meta:[{title:"Aplicações — Equipa comercial MM Club"},{name:"description",content:"Aplicações e contactos da equipa comercial MM Club."},{property:"og:title",content:"Aplicações — Equipa comercial MM Club"},{property:"og:description",content:"Leads e acompanhamento comercial."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"},{name:"robots",content:"noindex,nofollow"}]}),
  component:()=> <AplicacoesPage commercial />,
  pendingComponent: PageSkeleton,
});