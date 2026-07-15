import { createFileRoute, Link, Outlet, redirect, useRouter, useRouterState } from "@tanstack/react-router";
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
  Home,
  UserRound,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { MMLogo } from "@/components/mm/logo";
import { GlobalSearch } from "@/components/mm/global-search";

import { cn } from "@/lib/utils";
// Boot-time: apply admin overrides to in-memory data
import "@/data/admin-store";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      throw redirect({
        to: "/auth",
        search: { redirect: location.pathname } as never,
        replace: true,
      });
    }

    return { authUser: data.session.user };
  },
  component: AppLayout,
});

type NavTo = "/" | "/academia" | "/jade" | "/ferramentas" | "/lives" | "/comunidade" | "/eventos" | "/perfil";
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
  {
    label: "Conta",
    items: [{ to: "/perfil", label: "Perfil", icon: UserRound }],
  },
];

const flatNav = navSections.flatMap((s) => s.items);

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const { authUser: initialAuthUser } = Route.useRouteContext() as { authUser: User };
  const { theme, toggle: toggleTheme, mounted: themeMounted } = useTheme();
  const [authUser, setAuthUser] = useState<User | null>(initialAuthUser);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("mm.sidebar.collapsed") === "1");
    setMounted(true);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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

  // Gate: require account to access any /_app route
  useEffect(() => {
    if (authUser === null) {
      const redirect = pathname && pathname !== "/auth" ? pathname : "/";
      router.navigate({ to: "/auth", search: { redirect } as never, replace: true });
    }
  }, [authUser, pathname, router]);

  // Never render protected content after the session is cleared.
  if (!authUser) {
    return <div className="min-h-screen bg-background" />;
  }


  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
  };

  const displayName =
    (authUser?.user_metadata?.display_name as string | undefined) ??
    authUser?.email?.split("@")[0] ??
    "MM";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const themeLabel = theme === "dark" ? "Modo claro" : "Modo escuro";

  const SidebarInner = ({ compact }: { compact: boolean }) => (
    <>
      <div className={cn("flex h-20 items-center", compact ? "justify-center px-2" : "justify-between px-6")}>
        {compact ? (
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
            <div className="flex items-center gap-1">
              {/* Desktop collapse */}
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Fechar sidebar"
                className="hidden rounded-lg p-2 text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground lg:inline-flex"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
              {/* Mobile close */}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Fechar menu"
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground lg:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>

      <nav className={cn("flex-1 space-y-6 overflow-y-auto pb-4", compact ? "px-2" : "px-4")}>
        {navSections.map((section) => (
          <div key={section.label}>
            {!compact && (
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
                    title={compact ? item.label : undefined}
                    className={cn(
                      "group flex items-center rounded-xl text-sm transition-all",
                      compact ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
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
                    {!compact && <span className="flex-1">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {!compact && (
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

      <div className={cn("border-t border-border", compact ? "p-2" : "p-4")}>
        {authUser ? (
          compact ? (
            <Link
              to="/perfil"
              aria-label="Perfil"
              title={displayName}
              className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-gold-soft"
            >
              {initials}
            </Link>
          ) : (
            <div className="flex items-center gap-2 rounded-lg px-2 py-2">
              <Link
                to="/perfil"
                aria-label="Perfil"
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg transition hover:bg-sidebar-accent -mx-1 px-1 py-1"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">Membro MM Club</p>
                </div>
              </Link>
              <button
                onClick={handleSignOut}
                aria-label="Sair"
                className="shrink-0 rounded-lg p-2 text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )

        ) : authUser === null ? (
          <Link
            to="/auth"
            title={compact ? "Entrar" : undefined}
            className={cn(
              "flex items-center rounded-lg text-sm text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground",
              compact ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
            )}
          >
            <LogIn className="h-4 w-4" />
            {!compact && <span className="flex-1">Entrar</span>}
          </Link>
        ) : (
          <div className="h-9" />
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-out lg:flex",
          collapsed ? "w-[76px]" : "w-64",
        )}
      >
        <SidebarInner compact={collapsed} />
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          onClick={() => setMobileOpen(false)}
          className={cn(
            "absolute inset-0 bg-background/70 backdrop-blur-sm transition-opacity duration-200",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-sidebar shadow-2xl transition-transform duration-200 ease-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <SidebarInner compact={false} />
        </aside>
      </div>

      {/* Main */}
      <div className={cn("transition-[padding] duration-200 ease-out", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center gap-2 bg-background/80 px-3 pt-3 pb-3 backdrop-blur-xl sm:gap-4 sm:px-4 sm:pt-4 sm:pb-4 md:px-8 md:pt-6">
          {/* Mobile: menu button opens the slide-in sidebar */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-1 text-foreground ring-1 ring-border transition hover:bg-surface-2 lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Mobile logo */}
          <div className="flex shrink-0 items-center lg:hidden">
            <MMLogo />
          </div>

          <div
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 sm:gap-3",
              pathname === "/"
                ? "justify-end sm:justify-between sm:rounded-2xl sm:border sm:border-border sm:bg-surface-1 sm:px-5 sm:py-3 md:py-4"
                : "justify-end",
            )}
          >
            {pathname === "/" && (
              <div className="hidden min-w-0 sm:block">
                <p className="truncate font-display text-sm leading-tight text-foreground sm:text-lg md:text-xl">
                  Bem-vindo, <span className="text-primary">{displayName.split(" ")[0]}</span>.
                </p>
                <p className="mt-0.5 hidden text-xs text-muted-foreground md:block">
                  Continua a construir a tua marca milionária.
                </p>
              </div>
            )}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {pathname === "/" && (
                <div className="hidden md:block">
                  <GlobalSearch variant="icon" />
                </div>
              )}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={themeLabel}
                title={themeLabel}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-muted-foreground transition hover:text-foreground sm:h-10 sm:w-10"
              >
                {themeMounted ? <ThemeIcon className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
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
                className="relative flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-muted-foreground transition hover:text-foreground sm:h-10 sm:w-10"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary sm:right-2.5 sm:top-2.5" />
              </Link>
              <Link
                to="/perfil"
                aria-label="Perfil"
                className="ml-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-2 ring-background transition hover:bg-gold-soft sm:ml-1 sm:h-10 sm:w-10"
              >
                {initials}
              </Link>
            </div>
          </div>
        </header>

        {/* Mobile search — só na home */}
        {pathname === "/" && (
          <div className="border-b border-border px-3 py-2.5 sm:px-4 sm:py-3 md:hidden">
            <GlobalSearch />
            <div className="mt-3">
              <p className="font-display text-base leading-tight text-foreground">
                Bem-vindo, <span className="text-primary">{displayName.split(" ")[0]}</span>.
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Continua a construir a tua marca milionária.
              </p>
            </div>
          </div>
        )}


        <main className="mx-auto max-w-7xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6 md:px-8 md:pt-8 lg:pb-12">
          {mounted && authUser ? <Outlet /> : <div className="min-h-[60vh]" />}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <MobileTabBar
        pathname={pathname}
        initials={initials}
        onOpenMore={() => setMobileOpen(true)}
      />
    </div>
  );
}

type TabItem = {
  to: NavTo;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const mobileTabs: TabItem[] = [
  { to: "/", label: "Início", icon: Home, exact: true },
  { to: "/academia", label: "Academia", icon: GraduationCap },
  { to: "/jade", label: "Jade", icon: Sparkles },
  { to: "/comunidade", label: "Comunidade", icon: Users },
];

function MobileTabBar({
  pathname,
  initials,
  onOpenMore,
}: {
  pathname: string;
  initials: string;
  onOpenMore: () => void;
}) {
  // Hide on lesson pages for a distraction-free view
  if (/^\/academia\/[^/]+\/[^/]+/.test(pathname)) return null;

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  const profileActive = pathname === "/perfil" || pathname.startsWith("/perfil/");
  void onOpenMore;

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-black/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {mobileTabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.to, tab.exact);
          return (
            <li key={tab.to} className="flex-1">
              <Link
                to={tab.to}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
                className="group relative flex flex-col items-center justify-center gap-1 px-2 pt-2.5 pb-2 text-[10px] font-medium transition-colors"
              >
                <span
                  className={cn(
                    "absolute top-0 h-[2px] w-8 rounded-full transition-all duration-300",
                    active ? "bg-primary opacity-100" : "bg-primary opacity-0",
                  )}
                />
                <Icon
                  className={cn(
                    "h-[22px] w-[22px] transition-all duration-200",
                    active
                      ? "text-primary scale-110"
                      : "text-muted-foreground group-active:scale-95",
                  )}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span
                  className={cn(
                    "transition-colors duration-200",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <Link
            to="/perfil"
            aria-label="Perfil"
            aria-current={profileActive ? "page" : undefined}
            className="group relative flex w-full flex-col items-center justify-center gap-1 px-2 pt-2.5 pb-2 text-[10px] font-medium transition-colors"
          >
            <span
              className={cn(
                "absolute top-0 h-[2px] w-8 rounded-full transition-all duration-300",
                profileActive ? "bg-primary opacity-100" : "bg-primary opacity-0",
              )}
            />
            <span
              className={cn(
                "flex h-[22px] w-[22px] items-center justify-center rounded-full text-[9px] font-semibold transition-all duration-200",
                profileActive
                  ? "bg-primary text-primary-foreground scale-110"
                  : "bg-surface-2 text-muted-foreground group-active:scale-95",
              )}
            >
              {initials || <UserRound className="h-3.5 w-3.5" />}
            </span>
            <span
              className={cn(
                "transition-colors duration-200",
                profileActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              Perfil
            </span>
          </Link>
        </li>

      </ul>
    </nav>
  );
}
