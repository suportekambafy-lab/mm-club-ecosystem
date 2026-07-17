import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Ban,
  HandCoins,
  FileWarning,
  Lock,
  Users,
  Sparkles,
  Gavel,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/codigo")({
  component: CodigoDoClube,
});

type Rule = {
  icon: typeof ShieldCheck;
  title: string;
  body: React.ReactNode;
};

const rules: Rule[] = [
  {
    icon: ShieldCheck,
    title: "Respeito acima de tudo",
    body: (
      <>
        Trata todos os membros com respeito. Não são permitidos insultos,
        discriminação, ameaças ou ataques pessoais.
      </>
    ),
  },
  {
    icon: Ban,
    title: "Sem spam",
    body: (
      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
        <li>• Publicidade não autorizada</li>
        <li>• Mensagens repetidas</li>
        <li>• Links de afiliados sem contexto</li>
        <li>• Autopromoção excessiva</li>
      </ul>
    ),
  },
  {
    icon: HandCoins,
    title: "Não utilizes o clube para vender aos membros",
    body: (
      <>
        O networking é incentivado. A prospeção agressiva e o envio de mensagens
        privadas para vender produtos ou serviços não são permitidos sem
        consentimento.
      </>
    ),
  },
  {
    icon: FileWarning,
    title: "Conteúdo adequado",
    body: (
      <>
        É proibido publicar conteúdo ilegal, ofensivo, discriminatório,
        enganoso ou protegido por direitos de autor sem autorização.
      </>
    ),
  },
  {
    icon: Lock,
    title: "Protege o MM Club",
    body: (
      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
        <li>• Partilhar credenciais</li>
        <li>• Revender acessos</li>
        <li>• Distribuir cursos</li>
        <li>• Gravar conteúdos exclusivos para terceiros</li>
      </ul>
    ),
  },
  {
    icon: Users,
    title: "Respeita especialistas e membros",
    body: (
      <>
        Discordar faz parte do crescimento. Desrespeitar pessoas não faz parte
        da cultura do MM Club.
      </>
    ),
  },
  {
    icon: Sparkles,
    title: "Publica com qualidade",
    body: (
      <>
        Utiliza as categorias corretas. Partilha conhecimento real, ajuda outros
        membros e celebra conquistas.
      </>
    ),
  },
  {
    icon: Gavel,
    title: "Medidas disciplinares",
    body: (
      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
        <li>• Aviso</li>
        <li>• Remoção de conteúdo</li>
        <li>• Suspensão temporária</li>
        <li>• Suspensão permanente</li>
        <li>• Banimento definitivo</li>
        <li className="pt-1 text-xs italic text-muted-foreground/80">
          Em situações graves, estas medidas poderão ser aplicadas imediatamente.
        </li>
      </ul>
    ),
  },
];

function CodigoDoClube() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alreadyAccepted, setAlreadyAccepted] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("club_code_accepted_at")
        .eq("id", u.user.id)
        .maybeSingle();
      const at = (data as { club_code_accepted_at?: string | null } | null)
        ?.club_code_accepted_at;
      if (at) {
        setAlreadyAccepted(at);
        setAccepted(true);
        setChecked(true);
      }
    })();
  }, []);

  const handleAccept = async () => {
    if (!checked || saving) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ club_code_accepted_at: new Date().toISOString() })
      .eq("id", u.user.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível guardar. Tenta novamente.");
      return;
    }
    setAccepted(true);
    toast.success("Bem-vindo ao MM Club.");
    router.navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-hairline bg-surface-1 px-6 py-14 sm:px-12 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 40% at 50% 0%, oklch(0.82 0.13 82 / 0.16), transparent 70%)",
          }}
        />
        <div className="flex flex-col items-start gap-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Comunidade Privada
          </span>
          <h1 className="font-display text-4xl leading-tight tracking-tight text-foreground sm:text-6xl">
            Código do Clube
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            O MM Club é uma comunidade privada construída para empreendedores
            que valorizam respeito, colaboração e crescimento. Para preservar a
            qualidade do clube, todos os membros devem aceitar este Código de
            Conduta.
          </p>
        </div>
      </section>

      {/* Rules */}
      <section className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2">
        {rules.map((rule, i) => {
          const Icon = rule.icon;
          return (
            <article
              key={rule.title}
              className="group relative overflow-hidden rounded-2xl border border-hairline bg-surface-1 p-6 transition hover:border-primary/30"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-1 font-display text-lg tracking-tight text-foreground">
                    {rule.title}
                  </h3>
                  <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {rule.body}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {/* Filosofia */}
      <section className="relative mt-10 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-surface-1 to-surface-1 px-6 py-12 sm:mt-14 sm:px-12 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl"
        />
        <p className="font-display text-[11px] uppercase tracking-[0.28em] text-primary">
          Filosofia MM Club
        </p>
        <h2 className="mt-3 font-display text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
          A qualidade da comunidade está acima de tudo.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          O MM Club não foi criado para ter milhares de membros. Foi criado para
          reunir os empreendedores certos. Cada membro influencia diretamente a
          qualidade da comunidade. Queremos um espaço onde exista respeito,
          colaboração e crescimento verdadeiro.
        </p>
      </section>

      {/* Aceitação */}
      <section className="mt-10 rounded-3xl border border-hairline bg-surface-1 p-6 sm:mt-14 sm:p-10">
        {alreadyAccepted ? (
          <div className="flex flex-col items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
              <Check className="h-5 w-5" />
            </div>
            <h3 className="font-display text-2xl tracking-tight text-foreground">
              Já fazes parte do MM Club.
            </h3>
            <p className="text-sm text-muted-foreground">
              Código aceite em{" "}
              <span className="text-foreground">
                {new Date(alreadyAccepted).toLocaleString("pt-PT", {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </span>
              .
            </p>
          </div>
        ) : (
          <>
            <label className="flex cursor-pointer items-start gap-4">
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition",
                  checked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background",
                )}
              >
                {checked && <Check className="h-4 w-4" strokeWidth={3} />}
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                disabled={accepted}
              />
              <span className="text-sm leading-relaxed text-foreground sm:text-base">
                Confirmo que li e compreendi o Código do Clube e comprometo-me
                a respeitar todas as regras da comunidade.
              </span>
            </label>

            <button
              type="button"
              onClick={handleAccept}
              disabled={!checked || saving}
              className={cn(
                "mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 font-display text-base tracking-wide transition sm:w-auto",
                checked && !saving
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-gold-soft"
                  : "cursor-not-allowed bg-surface-2 text-muted-foreground",
              )}
            >
              {saving ? "A guardar…" : "Entrar no MM Club"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
