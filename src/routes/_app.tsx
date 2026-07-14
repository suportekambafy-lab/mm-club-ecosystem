import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  GraduationCap,
  Sparkles,
  Wrench,
  Radio,
  Users,
  CalendarDays,
  Bell,
} from "lucide-react";
import { MMLogo } from "@/components/mm/logo";
import { GlobalSearch } from "@/components/mm/global-search";
import { currentUser } from "@/data/user";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

type NavItem = {
  to: "/" | "/academia" | "/jade" | "/ferramentas" | "/lives" | "/comunidade" | "/eventos";
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const nav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/academia", label: "Academia", icon: GraduationCap },
  { to: "/jade", label: "Jade", icon: Sparkles },
  { to: "/ferramentas", label: "Ferramentas", icon: Wrench },
  { to: "/lives", label: "Lives", icon: Radio },
  { to: "/comunidade", label: "Comunidade", icon: Users },
  { to: "/eventos", label: "Eventos", icon: CalendarDays },
];

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center px-6">
          <MMLogo />
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                  active
                    ? "bg-surface-2 text-foreground ring-1 ring-[color:var(--hairline)]"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 transition",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>

        {/* profile */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {currentUser.avatarInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {currentUser.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Membro MM Club
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-8">
          <div className="lg:hidden">
            <MMLogo />
          </div>
          <div className="hidden flex-1 md:flex">
            <GlobalSearch />
          </div>
          <div className="flex flex-1 justify-end md:flex-none">
            <button
              aria-label="Notificações"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-1/60 text-muted-foreground transition hover:border-[color:var(--hairline)] hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>
          </div>
        </header>

        {/* Mobile search */}
        <div className="border-b border-border px-4 py-3 md:hidden">
          <GlobalSearch />
        </div>

        {/* Mobile nav bar */}
        <nav className="sticky top-16 z-20 flex gap-1 overflow-x-auto border-b border-border bg-background/80 px-4 py-2 backdrop-blur-xl lg:hidden">
          {nav.map((item) => {
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

        <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
