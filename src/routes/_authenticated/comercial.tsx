import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { commercialSession } from "@/lib/commercial/commercial.functions";
import { ApplicationNotifications } from "@/components/admin/application-notifications";
import { SaleBroadcastListener } from "@/components/admin/sale-broadcast";
import { CallNotificationBell } from "@/components/commercial/scheduled-calls";
import mmIcon from "@/assets/mm-icon.png.asset.json";
import { ArrowLeft, Users, UserPlus, LayoutGrid, BriefcaseBusiness, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/comercial")({
  beforeLoad: async () => {
    try { return await commercialSession(); }
    catch { throw redirect({ to: "/", replace: true }); }
  },
  component: CommercialLayout,
});
function CommercialLayout() {
  const { isAdmin } = Route.useRouteContext();
  const [collapsed, setCollapsed] = useState(false);
  const items = [{ to: "/comercial", label: "Início", icon: LayoutGrid }, { to: "/comercial/aplicacoes", label: "Aplicações", icon: UserPlus }, { to: "/comercial/utilizadores", label: "Utilizadores", icon: Users }, { to: "/comercial/equipa", label: "Equipa", icon: BriefcaseBusiness }] as const;
  return <div className={`admin-shell commercial-shell min-h-screen bg-background text-foreground ${collapsed ? "commercial-collapsed" : ""}`}>
    <ApplicationNotifications commercial />
    <SaleBroadcastListener />
    <aside className="commercial-sidebar">
      <Link to="/comercial" className="flex items-center gap-3 px-3 py-3"><img src={mmIcon.url} alt="MM Club" className="h-9 w-9 shrink-0" /><div className="commercial-nav-label"><p className="text-lg font-semibold">MM Club</p><p className="text-xs text-muted-foreground">Comercial</p></div></Link>
      <p className="commercial-nav-label mb-3 mt-12 px-3 text-xs text-muted-foreground">ÁREA DE TRABALHO</p>
      <nav aria-label="Área comercial" className="commercial-nav flex gap-2 md:flex-col">{items.map(({ to, label, icon: Icon }) => <Button key={to} asChild variant="ghost" className="commercial-nav-item justify-start"><Link to={to} title={label} activeOptions={{ exact: true }} activeProps={{ "data-active": true }}><Icon className="shrink-0" /><span className="commercial-nav-label">{label}</span></Link></Button>)}</nav>
      <div className="commercial-sidebar-bottom"><Button asChild variant="ghost" className="w-full justify-start text-muted-foreground"><Link to={isAdmin ? "/admin" : "/dashboard"} title={isAdmin ? "Admin" : "Clube"}><ArrowLeft /><span className="commercial-nav-label">Voltar ao {isAdmin ? "admin" : "clube"}</span></Link></Button></div>
    </aside>
    <div className="commercial-workspace"><header className="commercial-topbar flex h-16 items-center justify-between gap-3 border-b border-border px-5 md:px-9"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" title={collapsed ? "Expandir menu" : "Recolher menu"} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} onClick={() => setCollapsed(!collapsed)} className="hidden md:inline-flex">{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button><span className="text-sm text-muted-foreground">MM Club <span className="mx-2 text-border">/</span> Comercial</span></div><span className="flex items-center gap-2 text-xs"><span className="h-1.5 w-1.5 rounded-full bg-commercial-success" />{isAdmin ? "Administrador" : "SDR & Closer"}</span></header><main className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12"><Outlet /></main></div>
  </div>;
}