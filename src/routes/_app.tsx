import { createFileRoute, Link, Outlet, redirect, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  GraduationCap,
  Bot,
  Wrench,
  Radio,
  Users,
  CalendarDays,
  
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
  ShieldCheck,
  Clapperboard,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { MMLogo } from "@/components/mm/logo";
import { GlobalSearch } from "@/components/mm/global-search";
import { NotificationsBell } from "@/components/mm/notifications";

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

    const userId = data.session.user.id;

    // Admins bypass the subscription gate
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!isAdmin) {
      const { getStripeEnvironment } = await import("@/lib/stripe");
      const env = getStripeEnvironment();
      const { data: hasSub } = await supabase.rpc("has_active_subscription", {
        user_uuid: userId,
        check_env: env,
      });
      if (!hasSub) {
        throw redirect({ to: "/checkout", replace: true });
      }
    }

    // Club Code gate — force acceptance on first login
    const { data: prof } = await supabase
      .from("profiles")
      .select("club_code_accepted_at")
      .eq("id", userId)
      .maybeSingle();
    const codeAccepted = Boolean(
      (prof as { club_code_accepted_at?: string | null } | null)
        ?.club_code_accepted_at,
    );
    if (!codeAccepted && location.pathname !== "/codigo") {
      throw redirect({ to: "/codigo", replace: true });
    }

    return { authUser: data.session.user, codeAccepted };
  },
  component: AppLayout,
});

type NavTo = "/dashboard" | "/academia" | "/jade" | "/ferramentas" | "/lives" | "/comunidade" | "/shorts" | "/eventos" | "/perfil" | "/codigo";
type NavItem = {
  to: NavTo;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  soon?: boolean;
};

// Editorial single-list nav — MasterClass / Apple TV energy, no SaaS group labels.
const navItems: NavItem[] = [
  { to: "/dashboard", label: "Início", icon: Home, exact: true },
  { to: "/academia", label: "Academia", icon: GraduationCap },
  { to: "/jade", label: "MM Intelligence", icon: Star },
  { to: "/lives", label: "Ao Vivo", icon: Radio },
  { to: "/comunidade", label: "Comunidade", icon: Users },
  { to: "/shorts", label: "MM Shorts", icon: Clapperboard },
  { to: "/ferramentas", label: "Ferramentas", icon: Wrench, soon: true },
  { to: "/eventos", label: "Eventos", icon: CalendarDays, soon: true },
  { to: "/codigo", label: "Código do Clube", icon: ShieldCheck },
];

const flatNav = navItems;

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const { authUser: initialAuthUser, codeAccepted: initialCodeAccepted } = Route.useRouteContext() as { authUser: User; codeAccepted: boolean };
  const { theme, toggle: toggleTheme, mounted: themeMounted } = useTheme();
  const codeAccepted = initialCodeAccepted;
  const [authUser, setAuthUser] = useState<User | null>(initialAuthUser);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
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

  // Load user's avatar from private bucket
  useEffect(() => {
    let cancelled = false;
    if (!authUser) {
      setAvatarSrc(null);
      return;
    }
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", authUser.id)
        .maybeSingle();
      const path = prof?.avatar_url;
      if (!path) {
        if (!cancelled) setAvatarSrc(null);
        return;
      }
      if (/^https?:\/\//i.test(path)) {
        if (!cancelled) setAvatarSrc(path);
        return;
      }
      const { data, error } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60);
      if (cancelled) return;
      setAvatarSrc(error ? null : data.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

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
      <div className={cn("flex h-20 items-center pt-[env(safe-area-inset-top)]", compact ? "justify-center px-2" : "justify-between px-6")}>
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

      <nav className={cn("flex-1 overflow-y-auto pb-4", compact ? "px-2 pt-2" : "px-4 pt-4")}>
        <div className={cn("space-y-1", !compact && "space-y-1.5")}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.exact);
            const locked = !codeAccepted && item.to !== "/codigo";
            if (item.soon || locked) {
              const badge = locked ? "Bloqueado" : "Em breve";
              return (
                <div
                  key={item.to}
                  title={compact ? `${item.label} — ${badge}` : undefined}
                  aria-disabled="true"
                  className={cn(
                    "group relative flex items-center rounded-xl cursor-not-allowed",
                    compact
                      ? "justify-center px-2 py-3 text-sm text-muted-foreground/70"
                      : "gap-4 px-4 py-3 font-display text-[15px] tracking-wide text-muted-foreground/60",
                  )}
                >
                  <Icon className="h-[19px] w-[19px] shrink-0 text-muted-foreground/50" />
                  {!compact && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                        {badge}
                      </span>
                    </>
                  )}
                </div>
              );
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                title={compact ? item.label : undefined}
                className={cn(
                  "group relative flex items-center rounded-xl transition-all duration-300",
                  compact
                    ? "justify-center px-2 py-3 text-sm"
                    : "gap-4 px-4 py-3 font-display text-[15px] tracking-wide",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {/* Gold left rail — editorial active indicator */}
                {!compact && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-all duration-300",
                      active ? "opacity-100 scale-y-100" : "opacity-0 scale-y-50",
                    )}
                  />
                )}
                <Icon
                  className={cn(
                    "h-[19px] w-[19px] shrink-0 transition",
                    active ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground",
                  )}
                />
                {!compact && <span className="flex-1">{item.label}</span>}
                {compact && active && (
                  <span
                    aria-hidden
                    className="absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-primary"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {!compact && (
        <div className="px-6 pb-5">
          <div className="border-t border-hairline pt-5">
            <p className="font-display text-[11px] uppercase tracking-[0.28em] text-muted-foreground/70">
              MM Club
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Um ecossistema para founders da próxima geração.
            </p>
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
              className="mx-auto flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-gold-soft"
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </Link>
          ) : (
            <div className="flex items-center gap-2 rounded-lg px-2 py-2">
              <Link
                to="/perfil"
                aria-label="Perfil"
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg transition hover:bg-sidebar-accent -mx-1 px-1 py-1"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
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
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ ["--mm-sidebar-w" as string]: collapsed ? "76px" : "256px" } as React.CSSProperties}
    >

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
        {/* Topbar — hidden on immersive routes */}
        {pathname !== "/shorts" && (
        <header className="sticky top-0 z-30 flex items-center gap-2 bg-background/80 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 backdrop-blur-xl sm:gap-4 sm:px-4 sm:pt-[calc(env(safe-area-inset-top)+1rem)] sm:pb-4 md:px-8 md:pt-[calc(env(safe-area-inset-top)+1.5rem)]">
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
              "flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3",
              pathname === "/dashboard" &&
                "sm:rounded-2xl sm:border sm:border-border sm:bg-surface-1 sm:px-5 sm:py-3 md:py-4",
            )}
          >
            {/* Greeting moved into cinematic dashboard hero — topbar stays minimal */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {pathname === "/dashboard" && (
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
              <NotificationsBell />
              <Link
                to="/perfil"
                aria-label="Perfil"
                className="ml-0.5 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-2 ring-background transition hover:bg-gold-soft sm:ml-1 sm:h-10 sm:w-10"
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </Link>
            </div>
          </div>
        </header>
        )}

        {/* Mobile search — só na home */}
        {pathname === "/dashboard" && (
          <div className="border-b border-border px-3 py-2.5 sm:px-4 sm:py-3 md:hidden">
            <GlobalSearch />
          </div>
        )}


        <main className={cn(
          pathname === "/shorts"
            ? "relative"
            : "relative mx-auto max-w-7xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6 md:px-8 md:pt-8 lg:pb-12 xl:max-w-[1600px] 2xl:max-w-[1760px]",
        )}>
          {/* Ambient editorial glow — matches landing page atmosphere */}
          {pathname !== "/shorts" && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
            style={{
              background:
                "radial-gradient(50% 30% at 80% 0%, oklch(0.82 0.13 82 / 0.09), transparent 70%), radial-gradient(40% 25% at 10% 40%, oklch(0.55 0.22 285 / 0.06), transparent 70%)",
            }}
          />
          )}
          {mounted && authUser ? <Outlet /> : <div className="min-h-[60vh]" />}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <MobileTabBar
        pathname={pathname}
        initials={initials}
        avatarSrc={avatarSrc}
        onOpenMore={() => setMobileOpen(true)}
        immersive={pathname === "/shorts"}
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
  { to: "/dashboard", label: "Início", icon: Home, exact: true },
  { to: "/shorts", label: "Shorts", icon: Clapperboard },
  { to: "/comunidade", label: "Comunidade", icon: Users },
  { to: "/jade", label: "MM AI", icon: Star },
];

function MobileTabBar({
  pathname,
  initials,
  avatarSrc,
  onOpenMore,
  immersive = false,
}: {
  pathname: string;
  initials: string;
  avatarSrc: string | null;
  onOpenMore: () => void;
  immersive?: boolean;
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
      data-mobile-tabbar
      className={cn(
        "fixed inset-x-0 z-40 flex justify-center px-3 lg:hidden",
        "bottom-[calc(env(safe-area-inset-bottom)+0.5rem)]",
      )}
    >
      <ul
        className={cn(
          "flex items-center gap-1 rounded-full px-3 py-2 shadow-2xl backdrop-blur-2xl backdrop-saturate-150 ring-1 transition-colors",
          immersive
            ? "bg-black/45 ring-white/15"
            : "bg-background/70 ring-border",
        )}
      >
        {mobileTabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.to, tab.exact);
          return (
            <li key={tab.to}>
              <Link
                to={tab.to}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-12 w-14 items-center justify-center rounded-full transition",
                  active
                    ? immersive
                      ? "text-white"
                      : "text-primary"
                    : immersive
                      ? "text-white/85 hover:text-white"
                      : "text-muted-foreground hover:text-foreground",
                )}

              >
                <Icon
                  className="h-[24px] w-[24px]"
                  strokeWidth={active ? 2.4 : 2}
                  fill={active && tab.to === "/shorts" ? "currentColor" : "none"}
                />
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            to="/perfil"
            aria-label="Perfil"
            aria-current={profileActive ? "page" : undefined}
            className={cn(
              "flex h-12 w-14 items-center justify-center rounded-full transition",
              profileActive && (immersive ? "ring-2 ring-white" : "ring-2 ring-primary"),
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold",
                immersive ? "bg-white/20 text-white" : "bg-surface-2 text-muted-foreground",
              )}
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                initials || <UserRound className="h-4 w-4" />
              )}
            </span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
