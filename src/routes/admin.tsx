import { createFileRoute, Link, Outlet, redirect, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Home,
  Bell,
  BookOpen,
  PlayCircle,
  CalendarDays,
  Radio,
  Wallet,
  Wrench,
  ArrowLeft,
  Sparkles,
  HeartPulse,
  Mail,
  ChevronLeft,
  ChevronRight,
  Repeat,
  TrendingUp,
  Ticket,
  Package,
  LifeBuoy,
  ArrowUpRight,
  Plus,
  Sun,
  Moon,
  ShieldCheck,
  Award,
  GraduationCap,
  Gavel,
  Headset,
} from "lucide-react";
import { cn } from "@/lib/utils";
import mmIcon from "@/assets/mm-icon.png.asset.json";
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
  | "/admin/progresso"
  | "/admin/transcricoes"
  | "/admin/quizzes"
  | "/admin/certificados"
  | "/admin/eventos"
  | "/admin/lives"
  | "/admin/ferramentas"
  | "/admin/comunicacao"
  | "/admin/seguranca"
  | "/admin/moderacao"
  | "/admin/suporte";

type NavItem = { to: AdminTo; label: string; icon: typeof Home; exact?: boolean };

const topNav: NavItem[] = [
  { to: "/admin", label: "Início", icon: Home, exact: true },
  { to: "/admin/saude", label: "Notificações", icon: Bell },
];

const nav: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Negócio",
    items: [
      { to: "/admin/financeiro", label: "Financeiro", icon: Wallet, exact: true },
      { to: "/admin/financeiro/receita", label: "Vendas", icon: TrendingUp },
      { to: "/admin/financeiro/subscricoes", label: "Subscrições", icon: Repeat },
      { to: "/admin/financeiro/cupoes", label: "Cupões", icon: Ticket },
      { to: "/admin/financeiro/catalogo", label: "Catálogo", icon: Package },
      { to: "/admin/saude", label: "Saúde do billing", icon: HeartPulse },
      { to: "/admin/comunicacao", label: "Comunicação", icon: Mail },

    ],
  },
  {
    label: "Conteúdo",
    items: [
      { to: "/admin/cursos", label: "Cursos", icon: BookOpen },
      { to: "/admin/aulas", label: "Aulas", icon: PlayCircle },
      { to: "/admin/progresso", label: "Progresso dos alunos", icon: GraduationCap },
      { to: "/admin/certificados", label: "Certificados & Sequências", icon: Award },
      { to: "/admin/quizzes", label: "MM Quiz", icon: GraduationCap },
      { to: "/admin/transcricoes", label: "Transcrições", icon: Sparkles },
    ],
  },
  {
    label: "Programação",
    items: [
      { to: "/admin/eventos", label: "Eventos", icon: CalendarDays },
      { to: "/admin/lives", label: "Lives", icon: Radio },
      { to: "/admin/ferramentas", label: "Ferramentas", icon: Wrench },
      { to: "/admin/moderacao", label: "Moderação", icon: Gavel },
      { to: "/admin/suporte", label: "Mensagens de suporte", icon: Headset },
      { to: "/admin/seguranca", label: "Segurança", icon: ShieldCheck },
    ],
  },
];

const CRUMBS: Record<string, string> = {
  "/admin": "Início",
  "/admin/financeiro": "Financeiro",
  "/admin/certificados": "Certificados & Sequências",
  "/admin/financeiro/receita": "Vendas",
  "/admin/financeiro/subscricoes": "Subscrições",
  "/admin/financeiro/cupoes": "Cupões",
  "/admin/financeiro/catalogo": "Catálogo",
  "/admin/saude": "Saúde do billing",
  "/admin/comunicacao": "Comunicação",
  "/admin/cursos": "Cursos",
  "/admin/aulas": "Aulas",
  "/admin/progresso": "Progresso dos alunos",
  "/admin/transcricoes": "Transcrições",
  "/admin/quizzes": "MM Quiz",
  "/admin/eventos": "Eventos",
  "/admin/lives": "Lives",
  "/admin/ferramentas": "Ferramentas",
  "/admin/moderacao": "Moderação",
  "/admin/suporte": "Mensagens de suporte",
  "/admin/seguranca": "Segurança",
};

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("mm-admin-theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("mm-admin-theme", next);
      return next;
    });
  };



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

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.to, item.exact);
    return (
      <Link
        key={item.to + item.label}
        to={item.to}
        className={cn(
          "group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors",
          active
            ? "bg-admin-hover text-admin-fg"
            : "text-admin-muted hover:bg-admin-panel hover:text-admin-fg",
        )}
      >
        <Icon strokeWidth={1.6} className="h-[15px] w-[15px] shrink-0 opacity-90" />
        <span className="flex-1 truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className={cn("admin-shell min-h-screen bg-admin-bg text-admin-fg", theme === "light" && "admin-light")}>

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] flex-col bg-admin-sidebar lg:flex">
        <div className="flex h-14 items-center px-4">
          <Link to="/admin" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-admin-panel-2">
              <img loading="lazy" decoding="async" src={mmIcon.url} alt="MM Club" className="h-5 w-5 object-contain" />
            </span>
            <span className="text-[14px] font-semibold tracking-[-0.01em] text-admin-fg">MMClub</span>
          </Link>

        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          <div className="space-y-0.5">{topNav.map(renderItem)}</div>
          {nav.map((section) => (
            <div key={section.label}>
              <p className="mb-1 px-2.5 text-[12px] text-admin-faint">{section.label}</p>
              <div className="space-y-0.5">{section.items.map(renderItem)}</div>
            </div>
          ))}
        </nav>

        <div className="space-y-0.5 px-3 pb-4">
          <a
            href="mailto:suporte@mmclub.pt"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] text-admin-muted transition hover:bg-admin-panel hover:text-admin-fg"
          >
            <LifeBuoy strokeWidth={1.6} className="h-[15px] w-[15px]" />
            Ajuda
          </a>
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] text-admin-muted transition hover:bg-admin-panel hover:text-admin-fg"
          >
            <ArrowLeft strokeWidth={1.6} className="h-[15px] w-[15px]" />
            Voltar ao site
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-[236px]">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-admin-bg px-4 md:px-5">
          <div className="flex items-center gap-2 lg:hidden">
            <img loading="lazy" decoding="async" src={mmIcon.url} alt="MM Club" className="h-6 w-6 object-contain" />
          </div>
          <div className="hidden items-center gap-1 lg:flex">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="flex h-7 w-7 items-center justify-center rounded-md text-admin-muted transition hover:bg-admin-panel hover:text-admin-fg"
              aria-label="Voltar"
            >
              <ChevronLeft strokeWidth={1.6} className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => window.history.forward()}
              className="flex h-7 w-7 items-center justify-center rounded-md text-admin-muted transition hover:bg-admin-panel hover:text-admin-fg"
              aria-label="Avançar"
            >
              <ChevronRight strokeWidth={1.6} className="h-4 w-4" />
            </button>
            <span className="mx-2 h-4 w-px bg-admin-border" />
            <span className="text-[13px] text-admin-faint">
              {CRUMBS[pathname] ?? pathname.replace("/admin/", "")}
            </span>
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Modo claro" : "Modo escuro"}
            className="flex h-7 w-7 items-center justify-center rounded-md text-admin-muted transition hover:bg-admin-panel hover:text-admin-fg"
          >
            {theme === "dark" ? (
              <Sun strokeWidth={1.6} className="h-4 w-4" />
            ) : (
              <Moon strokeWidth={1.6} className="h-4 w-4" />
            )}
          </button>
          <Link
            to="/admin/financeiro/catalogo"
            className="inline-flex items-center gap-1.5 rounded-lg bg-admin-panel-2 px-3 py-1.5 text-[13px] text-admin-fg transition hover:bg-admin-hover"
          >
            <Plus strokeWidth={1.8} className="h-3.5 w-3.5" />
            Catálogo
          </Link>
          <Link
            to="/admin/financeiro/subscricoes"
            className="inline-flex items-center gap-1.5 rounded-lg bg-admin-fg px-3 py-1.5 text-[13px] font-medium text-admin-bg transition hover:opacity-90"
          >
            <ArrowUpRight strokeWidth={1.8} className="h-3.5 w-3.5" />
            Clientes
          </Link>
        </header>

        {/* Mobile nav */}
        <nav className="sticky top-14 z-20 flex gap-1 overflow-x-auto bg-admin-bg px-4 py-2 lg:hidden">
          {[...topNav, ...nav.flatMap((s) => s.items)].map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to + item.label}
                to={item.to}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs transition",
                  active
                    ? "bg-admin-hover text-admin-fg"
                    : "text-admin-muted hover:text-admin-fg",
                )}
              >
                <Icon strokeWidth={1.6} className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="px-3 pb-12 md:px-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
