import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { commercialSession } from "@/lib/commercial/commercial.functions";
import { ApplicationNotifications } from "@/components/admin/application-notifications";
import mmIcon from "@/assets/mm-icon.png.asset.json";
import { ArrowLeft, Users, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/comercial")({
  beforeLoad: async () => {
    try { return await commercialSession(); }
    catch { throw redirect({ to: "/", replace: true }); }
  },
  component: CommercialLayout,
});
function CommercialLayout() {
  const { isAdmin } = Route.useRouteContext();
  return <div className="admin-shell min-h-screen bg-admin-bg text-admin-fg">
    <ApplicationNotifications commercial />
    <header className="border-b border-admin-border px-5 py-4">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <Link to="/comercial" className="flex items-center gap-3"><img src={mmIcon.url} alt="MM Club" className="h-8 w-8" /><div><p className="font-semibold">MM Club</p><p className="text-xs text-admin-muted">Equipa comercial</p></div></Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link to="/comercial" activeOptions={{ exact:true }} activeProps={{ className:"text-primary" }} className="flex items-center gap-2"><Users className="h-4 w-4" />Utilizadores</Link>
          <Link to="/comercial/aplicacoes" activeProps={{className:"text-primary"}} className="flex items-center gap-2"><UserPlus className="h-4 w-4" />Aplicações</Link>
          <Link to={isAdmin ? "/admin" : "/dashboard"} className="flex items-center gap-2 text-admin-muted"><ArrowLeft className="h-4 w-4" />{isAdmin ? "Admin" : "Clube"}</Link>
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6"><Outlet /></main>
  </div>;
}