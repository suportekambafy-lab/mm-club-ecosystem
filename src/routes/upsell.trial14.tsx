import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, Play, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { rememberIntendedPlan } from "@/lib/intended-plan";
import { startCheckout, startGuestCheckout } from "@/lib/billing.functions";
import { parseVideoUrl } from "@/lib/video-source";

const PRICE_SLUG = "mm_club_trial14";

/** Vídeo do upsell. Pode ser substituído por qualquer link (YouTube, Vimeo,
 * Bunny, Panda ou ficheiro directo) ou passado em ?v=<url>. */
const UPSELL_VIDEO_URL =
  "https://vz-5c879716-268.b-cdn.net/6a7d5a58-6740-4e2f-8915-d29bdc1051b9/playlist.m3u8";

/** Reprodutor que suporta HLS (.m3u8) em todos os browsers. */
function HlsVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const isHls = /\.m3u8(\?|$)/i.test(src);
    if (!isHls || el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = src;
      return;
    }
    let destroy: (() => void) | undefined;
    void import("hls.js").then(({ default: Hls }) => {
      if (!Hls.isSupported()) {
        el.src = src;
        return;
      }
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(el);
      destroy = () => hls.destroy();
    });
    return () => destroy?.();
  }, [src]);

  return (
    <video
      ref={ref}
      controls
      playsInline
      preload="metadata"
      className="absolute inset-0 h-full w-full object-contain"
    />
  );
}

export const Route = createFileRoute("/upsell/trial14")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { v?: string; email?: string; name?: string; trial?: string } => ({
    v: typeof search.v === "string" ? search.v : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
    name: typeof search.name === "string" ? search.name : undefined,
    trial: typeof search.trial === "string" ? search.trial : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Oferta exclusiva — 14 dias grátis no MM Club" },
      {
        name: "description",
        content:
          "Acabaste de entrar no Marca Milionária. Ativa agora 14 dias gratuitos no MM Club: workshops, comunidade, lives, IA e ferramentas premium.",
      },
      { property: "og:title", content: "14 dias gratuitos no MM Club" },
      {
        property: "og:description",
        content:
          "Oferta exclusiva para novos alunos do Marca Milionária: 14 dias de acesso completo ao MM Club.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UpsellTrial14,
});

const INCLUDED = [
  "Workshops exclusivos",
  "Comunidade privada",
  "Networking",
  "Inteligência Artificial",
  "Ferramentas Premium",
  "Lives e sessões exclusivas",
];

const OFFER = [
  "14 dias gratuitos",
  "Acesso imediato",
  "Cancelas quando quiseres durante o período experimental",
  "Depois apenas 29,90 €/mês caso decidas continuar",
];

function UpsellTrial14() {
  const search = Route.useSearch();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askEmail, setAskEmail] = useState(false);
  const [guestEmail, setGuestEmail] = useState<string>(search.email ?? "");
  const [guestName, setGuestName] = useState<string>(search.name ?? "");

  const video = parseVideoUrl(search.v ?? UPSELL_VIDEO_URL);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({ id: data.user.id, email: data.user.email ?? undefined });
        setGuestEmail((prev) => prev || data.user.email || "");
        const dn = (data.user.user_metadata as { display_name?: string } | null)
          ?.display_name;
        if (dn) setGuestName((prev) => prev || dn);
      }
    });
  }, []);

  const handleStart = async () => {
    if (!user && !askEmail) {
      setAskEmail(true);
      return;
    }
    setPending(true);
    setError(null);
    rememberIntendedPlan(PRICE_SLUG, "vip");
    try {
      if (!user) {
        const res = await startGuestCheckout({
          data: {
            email: guestEmail.trim(),
            name: guestName.trim(),
            priceSlug: PRICE_SLUG,
            origin: window.location.origin,
          },
        });
        window.location.href = res.checkoutUrl;
        return;
      }
      const { checkoutUrl } = await startCheckout({
        data: {
          priceSlug: PRICE_SLUG,
          origin: window.location.origin,
          successPath: "/upsell/trial14?trial=success",
        },
      });
      window.location.href = checkoutUrl;
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível abrir o checkout. Tenta novamente.",
      );
      setPending(false);
    }
  };

  const cta = (
    <div className="w-full">
      <button
        onClick={handleStart}
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-6 py-5 text-base font-semibold text-primary-foreground shadow-[0_20px_50px_-20px_oklch(0.82_0.13_82_/_0.7)] transition hover:opacity-95 disabled:opacity-60 md:text-lg"
      >
        {pending ? "A abrir…" : "Ativar os meus 14 dias gratuitos"}
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Começa agora mesmo. Sem cobrança durante os 14 dias.
      </p>
      {error && !askEmail ? (
        <p className="mt-3 text-center text-sm text-destructive">{error}</p>
      ) : null}
    </div>
  );

  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-[520px] bg-[radial-gradient(ellipse_at_top,oklch(0.82_0.13_82_/_0.18),transparent_60%)]"
      />

      <main className="relative mx-auto flex max-w-2xl flex-col px-4 pb-20 pt-10 md:pt-16">
        {search.trial === "success" ? (
          <div className="mb-6 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
            Recebemos a confirmação. Os teus 14 dias estão a ser ativados.
          </div>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
        >
          Inscrição confirmada
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-4xl"
        >
          Não feches esta página.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base"
        >
          A tua inscrição no Marca Milionária está concluída. Antes de entrares,
          quero oferecer-te algo que não disponibilizamos ao público — disponível
          apenas nesta página, imediatamente após a tua inscrição.
        </motion.p>

        {/* Vídeo — centro da página */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-7 overflow-hidden rounded-3xl border border-border bg-black shadow-[0_30px_80px_-40px_oklch(0.82_0.13_82_/_0.35)]"
        >
          <div className="relative aspect-video w-full">
            {video.kind === "file" && video.fileUrl ? (
              <video
                src={video.fileUrl}
                controls
                playsInline
                autoPlay
                className="absolute inset-0 h-full w-full object-contain"
              />
            ) : video.embedUrl ? (
              <iframe
                src={video.embedUrl}
                title="Mensagem do Marcelo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <Play className="h-6 w-6" />
                </span>
                <p className="px-6 text-xs text-muted-foreground">
                  Vídeo a definir. Adiciona o link em UPSELL_VIDEO_URL ou usa
                  ?v=&lt;link&gt;.
                </p>
              </div>
            )}
          </div>
        </motion.div>

        <div className="mt-6">{cta}</div>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Experimenta gratuitamente o MM Club durante 14 dias.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
            Enquanto o Marca Milionária te mostra exatamente o que fazer, o MM
            Club garante que continuas a aprender, executar e evoluir todas as
            semanas.
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {INCLUDED.map((i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Check className="h-3 w-3" />
                </span>
                <span>{i}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-muted-foreground">
            Sem limitações. Exatamente a mesma experiência dos restantes
            membros.
          </p>
        </section>

        <section className="mt-10 rounded-3xl border border-primary/30 bg-card/60 p-7 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Oferta exclusiva para novos alunos
          </p>
          <ul className="mt-5 space-y-3">
            {OFFER.map((o) => (
              <li key={o} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Check className="h-3 w-3" />
                </span>
                <span>{o}</span>
              </li>
            ))}
          </ul>

          <div className="mt-7 flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Zero risco.</span>{" "}
              Experimenta durante 14 dias. Se não fizer sentido para ti, cancela
              antes do fim do período experimental e não será cobrado qualquer
              valor.
            </p>
          </div>

          <div className="mt-7">{cta}</div>
        </section>

        <p className="mt-10 text-center text-[11px] leading-relaxed text-muted-foreground">
          Esta oferta exclusiva está disponível apenas nesta página,
          imediatamente após a tua inscrição. Depois de a fechares, deixará de
          estar acessível.
        </p>
      </main>

      {askEmail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <motion.form
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            onSubmit={(e) => {
              e.preventDefault();
              void handleStart();
            }}
            className="w-full max-w-md rounded-3xl bg-card p-7 ring-1 ring-border"
          >
            <h2 className="text-2xl font-semibold tracking-tight">
              Só falta o teu email
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Criamos o teu acesso ao MM Club automaticamente e enviamos-te os
              dados para este email.
            </p>

            <label className="mt-6 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Email
            </label>
            <input
              type="email"
              required
              autoFocus
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="tu@exemplo.com"
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />

            <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Nome
            </label>
            <input
              type="text"
              required
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="O teu nome"
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />

            {error ? (
              <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                pending ||
                !guestEmail.includes("@") ||
                guestName.trim().length < 2
              }
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-60"
            >
              {pending ? "A abrir pagamento…" : "Ativar os 14 dias gratuitos"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAskEmail(false);
                setError(null);
              }}
              className="mt-3 w-full text-center text-xs text-muted-foreground underline"
            >
              Cancelar
            </button>
          </motion.form>
        </div>
      ) : null}
    </div>
  );
}
