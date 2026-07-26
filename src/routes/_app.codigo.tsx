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
    <div className="mx-auto max-w-3xl">
      {/* Aviso topo — apenas se ainda não aceitou */}
      {!alreadyAccepted && (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm leading-relaxed text-foreground">
            Lê o Código até ao fim e concorda em baixo para teres acesso
            completo ao MM Club.
          </p>
        </div>
      )}

      {/* Cabeçalho simples */}
      <header className="border-b border-hairline pb-8">
        <p className="font-display text-[11px] uppercase tracking-[0.22em] text-primary">
          Comunidade Privada
        </p>
        <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
          Código do Clube
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          O MM Club é uma comunidade privada construída para empreendedores que
          valorizam respeito, colaboração e crescimento. Para preservar a
          qualidade do clube, todos os membros devem aceitar este Código de
          Conduta.
        </p>
      </header>

      {/* Regras */}
      <section className="divide-y divide-hairline">
        {rules.map((rule, i) => {
          const Icon = rule.icon;
          return (
            <article key={rule.title} className="flex items-start gap-4 py-7">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-base tracking-tight text-foreground sm:text-lg">
                  <span className="mr-2 text-primary/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {rule.title}
                </h3>
                <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {rule.body}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {/* Filosofia */}
      <section className="border-t border-hairline pt-8">
        <p className="font-display text-[11px] uppercase tracking-[0.22em] text-primary">
          Filosofia MM Club
        </p>
        <h2 className="mt-3 font-display text-xl tracking-tight text-foreground sm:text-2xl">
          A qualidade da comunidade está acima de tudo.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          O MM Club não foi criado para ter milhares de membros. Foi criado para
          reunir os empreendedores certos. Cada membro influencia diretamente a
          qualidade da comunidade. Queremos um espaço onde exista respeito,
          colaboração e crescimento verdadeiro.
        </p>
      </section>

      {/* Aceitação */}
      <section className="mt-8 rounded-2xl border border-hairline bg-surface-1 p-6 sm:p-8">
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
