import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { MMIcon } from "@/components/mm/logo";
import { cn } from "@/lib/utils";
import {
  APLICACAO_LINKS, OPCOES, PAISES_TEL, classificar, validarTelefone,
} from "@/lib/aplicacao/config";
import { saveLead } from "@/lib/aplicacao/aplicacao.functions";
import { firstMissingApplicationField } from "@/lib/aplicacao/validation";

export const Route = createFileRoute("/aplicacao")({
  head: () => ({
    meta: [
      { title: "Aplicação MM Club — mentoria de lojas online" },
      { name: "description", content: "Responde a 13 perguntas rápidas. A nossa equipa entra em contacto contigo no WhatsApp." },
      { property: "og:title", content: "Aplicação MM Club" },
      { property: "og:description", content: "13 perguntas, 2 minutos. A nossa equipa entra em contacto contigo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AplicacaoPage,
});

type Ans = Record<string, string>;
type Q =
  | { key: string; title: string; kind: "text" | "email" | "insta" | "phone" | "long"; placeholder?: string }
  | { key: keyof typeof OPCOES; title: string; kind: "choice" };

const QUESTIONS: Q[] = [
  { key: "nome", title: "Qual é o teu nome completo?", kind: "text" },
  { key: "whatsapp", title: "Qual é o teu WhatsApp?", kind: "phone" },
  { key: "email", title: "Qual é o teu melhor email?", kind: "email" },
  { key: "instagram", title: "Qual é o teu Instagram?", kind: "insta" },
  { key: "pais", title: "Onde moras hoje?", kind: "choice" },
  { key: "idade", title: "Qual é a tua idade?", kind: "choice" },
  { key: "ocupacao", title: "O que fazes hoje?", kind: "choice" },
  { key: "experiencia", title: "Qual é a tua experiência com loja online?", kind: "choice" },
  { key: "o_que_travou", title: "O que te travou até agora?", kind: "long", placeholder: "Se nunca tentaste, conta o que te impediu de começar." },
  { key: "tempo_dia", title: "Quanto tempo por dia consegues dedicar à tua loja?", kind: "choice" },
  { key: "verba_anuncios", title: "Quanto tens disponível para anúncios e testes de produto nos próximos 90 dias? (sem contar o acompanhamento)", kind: "choice" },
  { key: "investimento", title: "Se fizer sentido para ti, consegues investir num acompanhamento agora?", kind: "choice" },
  { key: "decisao", title: "Se a conversa fizer sentido, decides sozinho?", kind: "choice" },
];
const REQUIRED = QUESTIONS;
const STORE = "mm.aplicacao.v1";

function track(ev: string) { try { (window as any).fbq?.("track", ev); } catch { /* noop */ } }

function AplicacaoPage() {
  const save = useServerFn(saveLead);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(-1); // -1 início, 0..12 perguntas, 13 final
  const [ans, setAns] = useState<Ans>({});
  const [leadId, setLeadId] = useState<string | null>(null);
  const [cls, setCls] = useState<"A" | "B" | "C" | null>(null);
  const [utm, setUtm] = useState<Ans>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState("PT");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const s = JSON.parse(raw);
        const restored = s.ans ?? {};
        const missing = firstMissingApplicationField(restored);
        const missingStep = QUESTIONS.findIndex((question) => question.key === missing);
        setStep(!s.cls && missingStep >= 0 && s.step > missingStep ? missingStep : s.step ?? -1);
        setAns(restored); setLeadId(s.leadId ?? null);
        setCls(s.cls ?? null); setUtm(s.utm ?? {}); setPhoneCountry(s.pc ?? "PT");
      }
    } catch { /* noop */ }
    const p = new URLSearchParams(window.location.search);
    const u: Ans = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
      const v = p.get(k); if (v) u[k] = v.slice(0, 200);
    }
    if (Object.keys(u).length) setUtm(u);
    // Pixel da Meta
    const id = APLICACAO_LINKS.metaPixelId;
    if (id && id !== "PIXEL_ID" && !window.fbq) {
      const f = function (...a: unknown[]) { (f as any).queue.push(a); } as any;
      f.queue = []; f.loaded = true; f.version = "2.0"; f.callMethod = undefined;
      (window as any).fbq = f;
      const sc = document.createElement("script");
      sc.async = true; sc.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(sc);
      f("init", id); f("track", "PageView");
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORE, JSON.stringify({ step, ans, leadId, cls, utm, pc: phoneCountry }));
  }, [hydrated, step, ans, leadId, cls, utm, phoneCountry]);

  const q = step >= 0 && step < QUESTIONS.length ? QUESTIONS[step] : null;
  const progressIndex = q ? REQUIRED.indexOf(q) : -1;
  const answeredRequired = REQUIRED.filter((r) => QUESTIONS.indexOf(r) < step).length;

  async function persist(next: Ans, final = false) {
    if (!next.whatsapp) return null;
    const { id, classificacao } = await save({
      data: { id: leadId, final, ...next, email: next.email || null, ...utm },
    });
    setLeadId(id);
    return classificacao as "A" | "B" | "C" | null;
  }

  async function advance(next: Ans) {
    setErr(null);
    if (q && !next[q.key]?.trim()) return setErr("Responde a esta pergunta para continuar.");
    setAns(next);
    if (step === QUESTIONS.length - 1) {
      const missing = firstMissingApplicationField(next);
      if (missing) {
        setStep(QUESTIONS.findIndex((question) => question.key === missing));
        return setErr("Responde a esta pergunta para continuar.");
      }
      setBusy(true);
      try {
        const c = (await persist(next, true)) ?? classificar(next);
        setCls(c); track("Lead"); setStep(QUESTIONS.length);
      } catch { setErr("Não foi possível enviar. Tenta novamente."); }
      finally { setBusy(false); }
      return;
    }
    if (step >= 1) persist(next).catch(() => {});
    setStep(step + 1);
  }

  function submitText(value: string) {
    if (!q) return;
    const v = value.trim();
    if (!v) return setErr("Responde a esta pergunta para continuar.");
    if (q.kind === "text" && v.length < 3) return setErr("Escreve o teu nome completo.");
    if (q.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return setErr("Esse email não parece válido.");
    if (q.kind === "insta" && !/^[A-Za-z0-9._]{1,30}$/.test(v.replace(/^@/, ""))) return setErr("Escreve só o teu utilizador do Instagram.");
    if (q.kind === "phone") {
      const e = validarTelefone(phoneCountry, v);
      if (e) return setErr(e);
      const p = PAISES_TEL.find((x) => x.code === phoneCountry);
      if (!p) return setErr("Escolhe o país.");
      return advance({ ...ans, whatsapp: `+${p.dial}${v.replace(/\D/g, "")}`, whatsapp_local: v });
    }
    advance({ ...ans, [q.key]: q.kind === "insta" ? v.replace(/^@/, "") : v });
  }

  function restart() { localStorage.removeItem(STORE); setAns({}); setLeadId(null); setCls(null); setStep(-1); }

  if (!hydrated) return <div className="min-h-screen bg-background" />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-5 py-8">
        {q && (
          <div className="mb-8 space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <button type="button" onClick={() => { setErr(null); setStep(step - 1); }} className="inline-flex min-h-11 items-center gap-1 transition hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </button>
              <span>{`Pergunta ${progressIndex + 1} de ${REQUIRED.length}`}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(answeredRequired / REQUIRED.length) * 100}%` }} />
            </div>
          </div>
        )}

        <div key={step} className="flex flex-1 flex-col animate-[aplFade_.35s_ease-out] motion-reduce:animate-none">
          {step === -1 && <Intro onStart={() => setStep(0)} />}
          {q && q.kind === "choice" && (
            <Choice title={q.title} options={OPCOES[q.key] as readonly string[]} value={ans[q.key]} disabled={busy}
              onPick={(v) => { const next = { ...ans, [q.key]: v }; setAns(next); setTimeout(() => advance(next), 300); }} />
          )}
          {q && q.kind !== "choice" && (
            <TextQ q={q} initial={q.kind === "phone" ? ans.whatsapp_local ?? "" : ans[q.key] ?? ""} busy={busy}
              country={phoneCountry} setCountry={setPhoneCountry}
              onSubmit={submitText} />
          )}
          {err && <p role="alert" className="mt-4 text-sm text-destructive">{err}</p>}
          {step === QUESTIONS.length && cls === "A" && (
            <FinalA nome={ans.nome} whatsapp={ans.whatsapp} socio={ans.decisao?.startsWith("Preciso")} />
          )}
          {step === QUESTIONS.length && cls === "B" && (
            <Final title="Recebemos a tua aplicação." text="Alguém da nossa equipa vai falar contigo no WhatsApp nas próximas horas para perceber melhor o teu momento." cta="Seguir o MM Club no Instagram" />
          )}
          {step === QUESTIONS.length && cls === "C" && (
            <Final title="Obrigado pela tua aplicação." video cta="Conhecer o MM Club no Instagram" />
          )}
        </div>
        {step === QUESTIONS.length && (
          <button type="button" onClick={restart} className="mt-10 self-center text-xs text-muted-foreground underline-offset-4 hover:underline">Começar uma nova aplicação</button>
        )}
      </div>
      <style>{`@keyframes aplFade{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <MMIcon size={64} />
      <h1 className="mt-8 font-display text-4xl leading-tight md:text-5xl">
        Aplicação <span className="text-primary">MM Club</span>
      </h1>
      <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
        Responde a 13 perguntas rápidas. Leva 2 minutos. A nossa equipa fala contigo no WhatsApp.
      </p>
      <button type="button" onClick={onStart} className="mt-10 w-full max-w-sm rounded-full bg-primary px-6 py-4 text-base font-semibold text-primary-foreground transition hover:bg-gold-soft">
        Começar aplicação
      </button>
      <p className="mt-4 text-xs text-muted-foreground">As vagas de acompanhamento são limitadas por mês.</p>
    </div>
  );
}

function Choice({ title, options, value, onPick, disabled }: { title: string; options: readonly string[]; value?: string; onPick: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <h2 className="font-display text-2xl leading-snug md:text-3xl">{title}</h2>
      <div className="mt-8 space-y-3">
        {options.map((o) => {
          const sel = value === o;
          return (
            <button key={o} type="button" disabled={disabled} onClick={() => onPick(o)}
              className={cn("flex min-h-14 w-full items-center justify-between gap-3 rounded-[14px] bg-surface-1 px-5 py-4 text-left text-sm transition md:text-base",
                sel ? "ring-2 ring-primary" : "ring-1 ring-border hover:ring-primary")}>
              <span>{o}</span>
              {sel && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TextQ({ q, initial, onSubmit, busy, country, setCountry }: {
  q: Extract<Q, { kind: "text" | "email" | "insta" | "phone" | "long" }>; initial: string; onSubmit: (v: string) => void;
  busy: boolean; country: string; setCountry: (c: string) => void;
}) {
  const [v, setV] = useState(initial);
  const field = "w-full rounded-[14px] bg-surface-1 px-5 py-4 text-base text-foreground ring-1 ring-border outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary";
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}>
      <h2 className="font-display text-2xl leading-snug md:text-3xl">{q.title}</h2>
      <div className="mt-8">
        {q.kind === "long" ? (
          <textarea autoFocus rows={5} maxLength={2000} value={v} onChange={(e) => setV(e.target.value)} placeholder={q.placeholder} className={field} />
        ) : q.kind === "phone" ? (
          <div className="flex gap-2">
            <select aria-label="País" value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-[14px] bg-surface-1 px-3 text-base ring-1 ring-border outline-none focus:ring-2 focus:ring-primary">
              {PAISES_TEL.map((p) => <option key={p.code} value={p.code}>{p.flag} +{p.dial}</option>)}
            </select>
            <input autoFocus inputMode="tel" autoComplete="tel-national" value={v} onChange={(e) => setV(e.target.value)} placeholder="912 345 678" className={field} />
          </div>
        ) : q.kind === "insta" ? (
          <div className="relative">
            <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
            <input autoFocus value={v} maxLength={31} onChange={(e) => setV(e.target.value)} placeholder="utilizador" className={cn(field, "pl-10")} />
          </div>
        ) : (
          <input autoFocus type={q.kind === "email" ? "email" : "text"} autoComplete={q.kind === "email" ? "email" : "name"} maxLength={120} value={v} onChange={(e) => setV(e.target.value)} className={field} />
        )}
      </div>
      <button type="submit" disabled={busy} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-base font-semibold text-primary-foreground transition hover:bg-gold-soft disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Continuar
      </button>
    </form>
  );
}

function Final({ title, text, video, cta }: { title: string; text?: string; video?: boolean; cta: string }) {
  return (
    <div className="flex flex-1 flex-col justify-center text-center">
      <MMIcon size={48} className="mx-auto" />
      <h1 className="mt-6 font-display text-3xl leading-tight md:text-4xl">{title}</h1>
      {text && <p className="mt-4 text-base leading-relaxed text-muted-foreground">{text}</p>}
      {video && (
        <div className="mt-8 aspect-video overflow-hidden rounded-[14px] ring-1 ring-border">
          <iframe className="h-full w-full" src={`https://www.youtube.com/embed/${APLICACAO_LINKS.youtubeVideoId}`} title="MM Club" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      )}
      <a href={APLICACAO_LINKS.instagram} target="_blank" rel="noreferrer" className="mx-auto mt-8 inline-flex min-h-12 items-center rounded-full px-6 text-sm font-medium ring-1 ring-border transition hover:ring-primary">
        {cta}
      </a>
    </div>
  );
}

function FinalA({ nome, whatsapp, socio }: { nome?: string; whatsapp?: string; socio?: boolean }) {
  return (
    <div className="flex flex-1 flex-col justify-center text-center">
      <Check className="mx-auto h-10 w-10 text-primary" />
      <h1 className="mt-6 font-display text-3xl leading-tight md:text-4xl">
        Tens perfil para o <span className="text-primary">MM Club</span>.
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        Recebemos a tua aplicação{nome ? `, ${nome.split(" ")[0]}` : ""}. A nossa equipa entra em contacto contigo no WhatsApp nas próximas horas para agendar a tua conversa.
      </p>
      {whatsapp && (
        <div className="mt-6 rounded-[14px] bg-surface-1 p-5 text-left text-sm ring-1 ring-border">
          <p><span className="text-muted-foreground">WhatsApp:</span> {whatsapp}</p>
        </div>
      )}
      {socio && <p className="mt-4 rounded-[14px] p-4 text-sm ring-1 ring-primary/50">Traz a pessoa com quem decides para a conversa. Assim tiram as dúvidas juntos.</p>}
    </div>
  );
}
