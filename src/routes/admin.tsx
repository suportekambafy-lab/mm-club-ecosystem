import { createFileRoute, Link, Outlet, redirect, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  BookOpen,
  PlayCircle,
  CalendarDays,
  Radio,
  Wallet,
  Wrench,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  HeartPulse,
} from "lucide-react";
import { cn } from "@/lib/utils";
// Ensure admin overrides are applied
import "@/data/admin-store";

export const Route = createFileRoute("/admin")({
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

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: data.session.user.id,
      _role: "admin",
    });

    if (!isAdmin) {
      throw redirect({ to: "/", replace: true });
    }

    return { authUser: data.session.user };
  },
  head: () => ({
    meta: [
      { title: "Admin — MM Club" },
      { name: "description", content: "Painel de administração do MM Club." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminLayout,
});

type AdminTo =
  | "/admin"
  | "/admin/financeiro"
  | "/admin/financeiro/subscricoes"
  | "/admin/financeiro/receita"
  | "/admin/financeiro/cupoes"
  | "/admin/financeiro/catalogo"
  | "/admin/saude"
  | "/admin/cursos"
  | "/admin/aulas"
  | "/admin/transcricoes"
  | "/admin/eventos"
  | "/admin/lives"
  | "/admin/ferramentas";

const nav: Array<{
  label: string;
  items: Array<{ to: AdminTo; label: string; icon: typeof LayoutDashboard; exact?: boolean }>;
}> = [
  {
    label: "Negócio",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/admin/financeiro", label: "Financeiro", icon: Wallet, exact: true },
      { to: "/admin/financeiro/subscricoes", label: "Subscrições", icon: Repeat },
      { to: "/admin/financeiro/receita", label: "Receita", icon: TrendingUp },
      { to: "/admin/financeiro/cupoes", label: "Cupões", icon: Ticket },
      { to: "/admin/financeiro/catalogo", label: "Catálogo", icon: Package },
      { to: "/admin/saude", label: "Saúde do billing", icon: HeartPulse },
    ],
  },
  {
    label: "Conteúdo",
    items: [
      { to: "/admin/cursos", label: "Cursos", icon: BookOpen },
      { to: "/admin/aulas", label: "Aulas", icon: PlayCircle },
      { to: "/admin/transcricoes", label: "Transcrições", icon: Sparkles },
    ],
  },
  {
    label: "Programação",
    items: [
      { to: "/admin/eventos", label: "Eventos", icon: CalendarDays },
      { to: "/admin/lives", label: "Lives", icon: Radio },
    ],
  },
  {
    label: "Recursos",
    items: [{ to: "/admin/ferramentas", label: "Ferramentas", icon: Wrench }],
  },
];


function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.navigate({ to: "/auth", search: { redirect: pathname } as never, replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [pathname, router]);

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex h-20 items-center gap-2 border-b border-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="font-display text-sm font-semibold leading-tight">MM Admin</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Backoffice
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
          {nav.map((section) => (
            <div key={section.label}>
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.to, item.exact);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                        active
                          ? "bg-surface-2 text-foreground shadow-inner ring-1 ring-[color:var(--hairline)]"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition",
                          active
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground",
                        )}
                      />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar ao site</span>
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-background/80 px-4 py-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="font-display text-sm font-semibold">MM Admin</span>
          </div>
          <div className="flex-1" />
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao site
          </Link>
        </header>

        {/* Mobile nav */}
        <nav className="sticky top-16 z-20 flex gap-1 overflow-x-auto border-b border-border bg-background/80 px-4 py-2 backdrop-blur-xl lg:hidden">
          {nav.flatMap((s) => s.items).map((item) => {
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
