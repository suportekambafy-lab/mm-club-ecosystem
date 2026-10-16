import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { MMIcon } from "@/components/mm/logo";
import { cn } from "@/lib/utils";
import {
  APLICACAO_LINKS, OPCOES, PAISES_TEL, classificar, validarTelefone,
} from "@/lib/aplicacao/config";
import { saveLead, getSlots, bookSlot } from "@/lib/aplicacao/aplicacao.functions";

export const Route = createFileRoute("/aplicacao")({
  head: () => ({
    meta: [
      { title: "Aplicação MM Club — mentoria de lojas online" },
      { name: "description", content: "Responde a 12 perguntas rápidas e, se tiveres perfil, marca já a tua conversa com a equipa do MM Club." },
      { property: "og:title", content: "Aplicação MM Club" },
      { property: "og:description", content: "12 perguntas, 2 minutos. Marca a tua conversa com a equipa do MM Club." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AplicacaoPage,
});

type Ans = Record<string, string>;
type Q =
  | { key: string; title: string; kind: "text" | "email" | "insta" | "phone" | "long"; optional?: boolean; placeholder?: string }
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
  { key: "o_que_travou", title: "Se já tentaste antes, o que te travou?", kind: "long", optional: true, placeholder: "Ex.: não encontrei produto, o anúncio não vendia, faltou dinheiro para testar..." },
  { key: "tempo_dia", title: "Quanto tempo por dia consegues dedicar à tua loja?", kind: "choice" },
  { key: "verba_anuncios", title: "Quanto tens disponível para anúncios e testes de produto nos próximos 90 dias? (sem contar o acompanhamento)", kind: "choice" },
  { key: "investimento", title: "Se fizer sentido para ti, consegues investir num acompanhamento agora?", kind: "choice" },
  { key: "decisao", title: "Se a conversa fizer sentido, decides sozinho?", kind: "choice" },
];
const REQUIRED = QUESTIONS.filter((q) => !("optional" in q && q.optional));
const STORE = "mm.aplicacao.v1";

declare global { interface Window { fbq?: (...a: unknown[]) => void } }
function track(ev: string) { try { window.fbq?.("track", ev); } catch { /* noop */ } }

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
        setStep(s.step ?? -1); setAns(s.ans ?? {}); setLeadId(s.leadId ?? null);
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
      window.fbq = f;
      const sc = document.createElement("script");
      sc.async = true; sc.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(sc);
      window.fbq("init", id); window.fbq("track", "PageView");
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
    setAns(next);
    if (step === QUESTIONS.length - 1) {
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
    if (q.kind === "text" && v.length < 3) return setErr("Escreve o teu nome completo.");
    if (q.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return setErr("Esse email não parece válido.");
    if (q.kind === "insta" && !/^[A-Za-z0-9._]{1,30}$/.test(v.replace(/^@/, ""))) return setErr("Escreve só o teu utilizador do Instagram.");
    if (q.kind === "phone") {
      const e = validarTelefone(phoneCountry, v);
      if (e) return setErr(e);
      const p = PAISES_TEL.find((x) => x.code === phoneCountry)!;
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
              <span>{progressIndex >= 0 ? `Pergunta ${progressIndex + 1} de ${REQUIRED.length}` : "Pergunta opcional"}</span>
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
              onSubmit={(v) => (q.optional && !v.trim() ? advance({ ...ans, [q.key]: "" }) : submitText(v))} />
          )}
          {err && <p role="alert" className="mt-4 text-sm text-destructive">{err}</p>}
          {step === QUESTIONS.length && cls === "A" && leadId && (
            <FinalA leadId={leadId} whatsapp={ans.whatsapp} socio={ans.decisao?.startsWith("Preciso")} />
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
        Responde a 12 perguntas rápidas. Leva 2 minutos. Se tiveres perfil, escolhes já o horário da tua conversa com a nossa equipa.
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
      {q.optional && <p className="mt-2 text-sm text-muted-foreground">Opcional.</p>}
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
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} {q.optional && !v.trim() ? "Saltar" : "Continuar"}
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

const fmtDay = (d: string) => new Intl.DateTimeFormat("pt-PT", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
const fmtLocal = (iso: string, tz?: string) => new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso));

function FinalA({ leadId, whatsapp, socio }: { leadId: string; whatsapp?: string; socio?: boolean }) {
  const fetchSlots = useServerFn(getSlots);
  const book = useServerFn(bookSlot);
  const [days, setDays] = useState<Awaited<ReturnType<typeof getSlots>> | null>(null);
  const [day, setDay] = useState(0);
  const [pick, setPick] = useState<{ date: string; time: string; iso: string } | null>(null);
  const [done, setDone] = useState<{ date: string; time: string; iso: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const diffTz = useMemo(() => fmtLocal("2026-01-15T12:00:00Z", tz) !== fmtLocal("2026-01-15T12:00:00Z", "Europe/Lisbon"), [tz]);

  const load = () => fetchSlots().then(setDays).catch(() => setErr("Não foi possível carregar os horários. Tenta novamente."));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirm() {
    if (!pick) return;
    setBusy(true); setErr(null);
    try { await book({ data: { leadId, iso: pick.iso } }); track("Schedule"); setDone(pick); setPick(null); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro."); setPick(null); load(); }
    finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="flex flex-1 flex-col justify-center text-center">
        <Check className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-6 font-display text-3xl md:text-4xl">Conversa confirmada</h1>
        <div className="mt-6 rounded-[14px] bg-surface-1 p-5 text-left text-sm ring-1 ring-border">
          <p><span className="text-muted-foreground">Dia:</span> {fmtDay(done.date)}</p>
          <p className="mt-1"><span className="text-muted-foreground">Hora:</span> {done.time} (Lisboa){diffTz && ` · ${fmtLocal(done.iso, tz)} na tua hora`}</p>
          <p className="mt-1"><span className="text-muted-foreground">WhatsApp:</span> {whatsapp}</p>
        </div>
        <p className="mt-6 text-base text-muted-foreground">Vamos falar contigo no WhatsApp antes da call para confirmar.</p>
        {socio && <p className="mt-4 rounded-[14px] p-4 text-sm ring-1 ring-primary/50">Traz a pessoa com quem decides para a call. Assim tiram as dúvidas juntos.</p>}
      </div>
    );
  }

  const cur = days?.[day];
  return (
    <div>
      <h1 className="font-display text-3xl leading-tight md:text-4xl">Tens perfil para o <span className="text-primary">MM Club</span>.</h1>
      <p className="mt-3 text-base text-muted-foreground">Escolhe o melhor dia e horário para a tua conversa com a nossa equipa.</p>
      {err && <p role="alert" className="mt-4 text-sm text-destructive">{err}</p>}
      {!days ? (
        <div className="mt-8 h-64 animate-pulse rounded-[14px] bg-surface-1" />
      ) : days.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Sem horários nos próximos dias. A nossa equipa vai falar contigo no WhatsApp.</p>
      ) : (
        <>
          <div className="-mx-5 mt-8 flex gap-2 overflow-x-auto px-5 pb-2">
            {days.map((d, i) => (
              <button key={d.date} type="button" onClick={() => setDay(i)}
                className={cn("min-h-12 shrink-0 rounded-[14px] bg-surface-1 px-4 text-sm capitalize transition", i === day ? "ring-2 ring-primary" : "ring-1 ring-border hover:ring-primary")}>
                {fmtDay(d.date)}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Hora de Lisboa{diffTz && " · por baixo, a tua hora local"}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {cur?.slots.map((s) => (
              <button key={s.iso} type="button" disabled={!s.free} onClick={() => setPick({ date: cur.date, time: s.time, iso: s.iso })}
                className="min-h-12 rounded-[14px] bg-surface-1 px-2 py-2 text-sm ring-1 ring-border transition hover:ring-primary disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:ring-border">
                {s.time}
                {diffTz && <span className="block text-[10px] text-muted-foreground">{fmtLocal(s.iso, tz)}</span>}
              </button>
            ))}
          </div>
        </>
      )}
      {pick && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-[14px] bg-surface-1 p-6 ring-1 ring-border">
            <h2 className="font-display text-xl">Confirmar conversa</h2>
            <div className="mt-4 space-y-1 text-sm">
              <p><span className="text-muted-foreground">Dia:</span> <span className="capitalize">{fmtDay(pick.date)}</span></p>
              <p><span className="text-muted-foreground">Hora:</span> {pick.time} (Lisboa){diffTz && ` · ${fmtLocal(pick.iso, tz)} na tua hora`}</p>
              <p><span className="text-muted-foreground">WhatsApp:</span> {whatsapp}</p>
            </div>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setPick(null)} className="min-h-12 flex-1 rounded-full text-sm ring-1 ring-border">Cancelar</button>
              <button type="button" disabled={busy} onClick={confirm} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
