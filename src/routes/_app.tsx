import { createFileRoute, Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  GraduationCap,
  Sparkles,
  Wrench,
  Radio,
  Users,
  CalendarDays,
  Bell,
  LogOut,
  LogIn,
  ShoppingBag,
  Star,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { MMLogo } from "@/components/mm/logo";
import { GlobalSearch } from "@/components/mm/global-search";
import { currentUser } from "@/data/user";
import { cn } from "@/lib/utils";
// Boot-time: apply admin overrides to in-memory data
import "@/data/admin-store";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

type NavTo = "/" | "/academia" | "/jade" | "/ferramentas" | "/lives" | "/comunidade" | "/eventos";
type NavItem = {
  to: NavTo;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

type NavSection = { label: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    label: "Geral",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/eventos", label: "Agenda", icon: CalendarDays },
      { to: "/comunidade", label: "Comunidade", icon: Users },
      { to: "/lives", label: "Lives", icon: Radio },
    ],
  },
  {
    label: "Cursos",
    items: [
      { to: "/academia", label: "Academia", icon: GraduationCap },
      { to: "/jade", label: "Jade", icon: Sparkles },
    ],
  },
  {
    label: "Recursos",
    items: [{ to: "/ferramentas", label: "Ferramentas", icon: Wrench }],
  },
];

const flatNav = navSections.flatMap((s) => s.items);

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("mm.sidebar.collapsed") === "1";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("mm.sidebar.collapsed", collapsed ? "1" : "0");
    }
  }, [collapsed]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setAuthUser(s?.user ?? null);
      router.invalidate();
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
  };

  const displayName =
    (authUser?.user_metadata?.display_name as string | undefined) ??
    authUser?.email?.split("@")[0] ??
    currentUser.name;
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-out lg:flex",
          collapsed ? "w-[76px]" : "w-64",
        )}
      >
        <div className={cn("flex h-20 items-center", collapsed ? "justify-center px-2" : "justify-between px-6")}>
          {collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Expandir sidebar"
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          ) : (
            <>
              <MMLogo />
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Fechar sidebar"
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        <nav className={cn("flex-1 space-y-6 overflow-y-auto pb-4", collapsed ? "px-2" : "px-4")}>
          {navSections.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                  {section.label}
                </p>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.to, item.exact);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group flex items-center rounded-xl text-sm transition-all",
                        collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                        active
                          ? "bg-surface-2 text-foreground shadow-inner ring-1 ring-[color:var(--hairline)]"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition",
                          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                        )}
                      />
                      {!collapsed && <span className="flex-1">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Premium promo */}
        {!collapsed && (
          <div className="px-4 pb-4">
            <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-violet to-violet-deep p-5 text-center text-violet-foreground shadow-lg shadow-violet/25">
              <div className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay [background-image:radial-gradient(circle_at_top_right,white,transparent_60%)]" />
              <p className="relative text-sm font-semibold leading-tight">
                24/7 Access to<br />o teu Painel Pessoal
              </p>
              <div className="relative mt-3 flex justify-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <button
                type="button"
                className="relative mt-4 inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-violet-deep transition hover:bg-white/90"
                onClick={() => router.navigate({ to: "/checkout" })}
              >
                Get Premium
              </button>
            </div>
          </div>
        )}

        {/* profile */}
        <div className={cn("border-t border-border", collapsed ? "p-2" : "p-4")}>
          {authUser ? (
            collapsed ? (
              <button
                onClick={handleSignOut}
                aria-label="Sair"
                title={displayName}
                className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
              >
                {initials}
              </button>
            ) : (
              <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">Membro MM Club</p>
                </div>
                <button
                  onClick={handleSignOut}
                  aria-label="Sair"
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )
          ) : authUser === null ? (
            <Link
              to="/auth"
              title={collapsed ? "Entrar" : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground",
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
              )}
            >
              <LogIn className="h-4 w-4" />
              {!collapsed && <span className="flex-1">Entrar</span>}
            </Link>
          ) : (
            <div className="h-9" />
          )}
        </div>
      </aside>

      {/* Main */}
      <div className={cn("transition-[padding] duration-200 ease-out", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center gap-4 bg-background/80 px-4 pt-4 pb-4 backdrop-blur-xl md:px-8 md:pt-6">
          <div className="lg:hidden">
            <MMLogo />
          </div>
          <div className="flex flex-1 items-center justify-between gap-3 rounded-2xl border border-border bg-surface-1 px-5 py-3 md:py-4">
            <div className="min-w-0">
              <p className="truncate font-display text-lg leading-tight text-foreground md:text-xl">
                Bem-vindo, <span className="text-primary">{displayName.split(" ")[0]}</span>.
              </p>
              <p className="mt-0.5 hidden text-xs text-muted-foreground md:block">
                Continua a construir a tua marca milionária.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:block">
                <GlobalSearch variant="icon" />
              </div>
              <Link
                to="/checkout"
                aria-label="Guardados"
                className="hidden h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-muted-foreground transition hover:text-foreground md:flex"
              >
                <ShoppingBag className="h-4 w-4" />
              </Link>
              <Link
                to="/comunidade"
                aria-label="Notificações"
                className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-muted-foreground transition hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-primary" />
              </Link>
              <div className="ml-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-2 ring-background">
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Mobile search */}
        <div className="border-b border-border px-4 py-3 md:hidden">
          <GlobalSearch />
        </div>

        {/* Mobile nav bar */}
        <nav className="sticky top-16 z-20 flex gap-1 overflow-x-auto border-b border-border bg-background/80 px-4 py-2 backdrop-blur-xl lg:hidden">
          {flatNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs transition",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="mx-auto max-w-7xl px-4 pb-12 pt-6 md:px-8 md:pt-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
