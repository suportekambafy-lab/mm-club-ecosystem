import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ArrowRight,
  BookOpen,
  Users,
  Radio,
  Wrench,
  Sparkles,
  Check,
  Crown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MMLogo } from "@/components/mm/logo";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "MM Club — Ecossistema privado da Marca Milionária" },
      {
        name: "description",
        content:
          "MM Club é o clube privado da Marca Milionária: cursos, Suporte IA, ferramentas, lives e comunidade para empreendedores portugueses.",
      },
    ],
  }),
  component: LandingPage,
});

const features = [
  { icon: BookOpen, title: "Academia", desc: "Cursos completos e novos módulos todos os meses." },
  { icon: Sparkles, title: "Suporte IA (Jade)", desc: "Assistente treinada com o método MM." },
  { icon: Users, title: "Comunidade", desc: "Rede privada de empreendedores portugueses." },
  { icon: Radio, title: "Lives exclusivas", desc: "Sessões ao vivo com especialistas." },
  { icon: Wrench, title: "Ferramentas & Templates", desc: "Checklists, prompts e recursos práticos." },
  { icon: Crown, title: "Acesso premium", desc: "Tudo num único ecossistema, sem extras." },
];

function LandingPage() {
  // If already signed in, send to dashboard.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace("/dashboard");
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
        <MMLogo />
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/checkout"
            className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground"
          >
            Planos
          </Link>
          <Link
            to="/auth"
            className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-surface-1"
          >
            Entrar
          </Link>
          <Link
            to="/checkout"
            className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-gold-soft"
          >
            Aderir <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        <section className="py-16 text-center sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <Crown className="h-3.5 w-3.5" /> Clube privado
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl leading-tight sm:text-6xl">
            O ecossistema privado para construíres a tua{" "}
            <span className="text-primary">marca milionária</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Cursos, Suporte IA, comunidade, lives e ferramentas — tudo num só lugar.
            Feito para empreendedores portugueses que querem resultados reais.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/checkout"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-gold-soft"
            >
              Ver planos <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium hover:bg-surface-1"
            >
              Já sou membro
            </Link>
          </div>
        </section>

        <section className="py-8">
          <h2 className="font-display text-3xl">O que vais encontrar dentro do clube</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-surface-1 p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16">
          <div className="rounded-3xl border border-border bg-surface-1 p-8 text-center sm:p-12">
            <h2 className="font-display text-3xl">Adere ao MM Club</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Três planos, um único acesso completo. Podes cancelar quando quiseres —
              garantia de 30 dias.
            </p>
            <ul className="mx-auto mt-6 grid max-w-md gap-2 text-left text-sm">
              {[
                "Acesso completo a todos os cursos",
                "Comunidade privada e lives mensais",
                "Suporte IA e ferramentas exclusivas",
                "Pagamento seguro pela Paddle",
              ].map((i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-primary" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link
                to="/checkout"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-gold-soft"
              >
                Escolher plano <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10">
        <div className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link to="/checkout" className="hover:text-foreground">Planos</Link>
            <Link to="/termos" className="hover:text-foreground">Termos e Condições</Link>
            <Link to="/privacidade" className="hover:text-foreground">Política de Privacidade</Link>
            <Link to="/reembolsos" className="hover:text-foreground">Política de Reembolsos</Link>
            <a href="mailto:geral@mmclub.pt" className="hover:text-foreground">Contacto</a>
          </nav>
          <p className="mt-4">© {new Date().getFullYear()} MMClub</p>
        </div>
      </footer>
    </div>
  );
}
