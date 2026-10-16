import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { commercialSession } from "@/lib/commercial/commercial.functions";
import { ApplicationNotifications } from "@/components/admin/application-notifications";
import { SaleBroadcastListener } from "@/components/admin/sale-broadcast";
import { CallNotificationBell } from "@/components/commercial/scheduled-calls";
import { AccountMenu } from "@/components/commercial/account-menu";
import mmIcon from "@/assets/mm-icon.png.asset.json";
import { LogOut, Users, UserPlus, LayoutGrid, BriefcaseBusiness, PanelLeftClose, PanelLeftOpen, Receipt } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CommercialShellSkeleton } from "@/components/ui/page-skeleton";

export const Route = createFileRoute("/_authenticated/comercial")({
  beforeLoad: async () => {
    try { return await commercialSession(); }
    catch { throw redirect({ to: "/", replace: true }); }
  },
  component: CommercialLayout,
  pendingComponent: CommercialShellSkeleton,
});
function CommercialLayout() {
  const { isAdmin } = Route.useRouteContext();
  const [collapsed, setCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await navigate({ to: "/comercial-login", search: { redirect: "/comercial" }, replace: true });
    } catch {
      toast.error("Não foi possível sair. Tenta novamente.");
      setSigningOut(false);
    }
  }
  const items = [{ to: "/comercial", label: "Início", icon: LayoutGrid }, { to: "/comercial/aplicacoes", label: "Aplicações", icon: UserPlus }, { to: "/comercial/vendas", label: "Minhas vendas", icon: Receipt }, { to: "/comercial/utilizadores", label: "Utilizadores", icon: Users }, { to: "/comercial/equipa", label: "Equipa", icon: BriefcaseBusiness }] as const;
  return <div className={`admin-shell commercial-shell min-h-screen bg-background text-foreground ${collapsed ? "commercial-collapsed" : ""}`}>
    <ApplicationNotifications commercial />
    <SaleBroadcastListener />
    <aside className="commercial-sidebar">
      <Link to="/comercial" className="flex items-center gap-3 px-3 py-3"><img src={mmIcon.url} alt="MM Club" className="h-9 w-9 shrink-0" /><div className="commercial-nav-label"><p className="text-lg font-semibold">MM Club</p><p className="text-xs text-muted-foreground">Comercial</p></div></Link>
      <p className="commercial-nav-label mb-3 mt-12 px-3 text-xs text-muted-foreground">ÁREA DE TRABALHO</p>
      <nav aria-label="Área comercial" className="commercial-nav flex gap-2 md:flex-col">{items.map(({ to, label, icon: Icon }) => <Button key={to} asChild variant="ghost" className="commercial-nav-item justify-start"><Link to={to} title={label} activeOptions={{ exact: true }} activeProps={{ "data-active": true }}><Icon className="shrink-0" /><span className="commercial-nav-label">{label}</span></Link></Button>)}</nav>
      <div className="commercial-sidebar-bottom"><Button variant="ghost" className="w-full justify-start text-muted-foreground" title="Sair da conta" aria-label="Sair da conta" disabled={signingOut} onClick={handleSignOut}><LogOut /><span className="commercial-nav-label">{signingOut ? "A sair…" : "Sair"}</span></Button></div>
    </aside>
    <div className="commercial-workspace"><header className="commercial-topbar flex h-16 items-center justify-between gap-3 border-b border-border px-5 md:px-9"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" title={collapsed ? "Expandir menu" : "Recolher menu"} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} onClick={() => setCollapsed(!collapsed)} className="hidden md:inline-flex">{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button><span className="text-sm text-muted-foreground">MM Club <span className="mx-2 text-border">/</span> Comercial</span></div><div className="flex items-center gap-3"><CallNotificationBell commercial /><AccountMenu isAdmin={isAdmin} /></div></header><main className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12"><Outlet /></main></div>
  </div>;
}