import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ChevronRight, Headset, Search, Send, X } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { authHeaders } from "@/lib/auth-headers";
import { SUPPORT_TOPICS, whatsappLink } from "@/lib/support-config";

const HUMAN_MARKER = "[[HUMANO]]";

function messageText(m: UIMessage): string {
  return (m.parts ?? [])
    .filter((p: { type: string }) => p.type === "text")
    .map((p) => (p as { text?: string }).text ?? "")
    .join("");
}

export function SupportWidget({ userName }: { userName?: string }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"home" | "chat">("home");
  const [query, setQuery] = useState("");
  const firstName = (userName ?? "").trim().split(" ")[0];

  const topics = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SUPPORT_TOPICS;
    return SUPPORT_TOPICS.filter((t) => t.title.toLowerCase().includes(q));
  }, [query]);

  const [pending, setPending] = useState<string | null>(null);

  function openChat(prompt?: string) {
    setPending(prompt ?? null);
    setView("chat");
  }

  return (
    <>
      {open && (
        <div className="fixed inset-x-3 bottom-20 z-[70] flex justify-end sm:inset-x-auto sm:right-5 sm:bottom-24">
          <div className="flex max-h-[min(88vh,820px)] w-full flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl sm:w-[440px]">
            {view === "home" ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="bg-foreground px-5 pt-5 pb-8 text-background">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Headset className="h-5 w-5" />
                      </span>
                      <span className="text-xs font-medium uppercase tracking-widest opacity-70">
                        MM Suporte
                      </span>
                    </div>
                    <button
                      onClick={() => setOpen(false)}
                      aria-label="Fechar suporte"
                      className="rounded-full p-1 opacity-70 transition hover:opacity-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="mt-6 font-display text-2xl opacity-60">
                    Olá{firstName ? ` ${firstName}` : ""} 👋
                  </p>
                  <h2 className="font-display text-2xl">Como podemos ajudar?</h2>
                </div>

                <div className="-mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-3">
                  <div className="rounded-2xl border border-border bg-surface-1 p-3 shadow-sm">
                    <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Procure ajuda"
                        className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                      />
                      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                    <ul className="mt-1 divide-y divide-border">
                      {topics.map((t) => (
                        <li key={t.id}>
                          <button
                            onClick={() => openChat(t.prompt)}
                            className="flex w-full items-center gap-3 px-1 py-3 text-left transition hover:text-primary"
                          >
                            <span className="flex-1 text-sm text-foreground">{t.title}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        </li>
                      ))}
                      {topics.length === 0 && (
                        <li className="px-1 py-3 text-sm text-muted-foreground">
                          Nada encontrado. Fala connosco abaixo.
                        </li>
                      )}
                    </ul>
                  </div>

                  <button
                    onClick={() => openChat(query.trim() || undefined)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-1 p-4 text-left shadow-sm transition hover:border-[color:var(--hairline)]"
                  >
                    <span className="flex-1">
                      <span className="block font-display text-base text-foreground">
                        Converse connosco
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Resposta imediata da IA do MM Club
                      </span>
                    </span>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Send className="h-4 w-4" />
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <SupportChat
                initialPrompt={pending}
                onConsumePrompt={() => setPending(null)}
                onBack={() => setView("home")}
                onClose={() => setOpen(false)}
              />
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed right-4 bottom-4 z-[70] inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background shadow-2xl transition hover:opacity-90 sm:right-5 sm:bottom-5"
      >
        {open ? <X className="h-4 w-4" /> : <Headset className="h-4 w-4" />}
        Suporte
      </button>
    </>
  );
}

function SupportChat({
  initialPrompt,
  onConsumePrompt,
  onBack,
  onClose,
}: {
  initialPrompt: string | null;
  onConsumePrompt: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/support", headers: () => authHeaders() }),
    [],
  );
  const { messages, sendMessage, status, error } = useChat({ id: "mm-suporte", transport });
  const isBusy = status === "submitted" || status === "streaming";

  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !initialPrompt) return;
    sent.current = true;
    void sendMessage({ text: initialPrompt });
    onConsumePrompt();
  }, [initialPrompt, onConsumePrompt, sendMessage]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const needsHuman = lastAssistant ? messageText(lastAssistant).includes(HUMAN_MARKER) : false;
  const lastUserText = [...messages].reverse().find((m) => m.role === "user");

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    setInput("");
    void sendMessage({ text: trimmed });
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-foreground px-4 py-3 text-background">
        <button
          onClick={onBack}
          className="text-xs opacity-70 transition hover:opacity-100"
          aria-label="Voltar"
        >
          Voltar
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="font-display text-sm">MM Suporte</p>
          <p className="text-[11px] opacity-60">Chat individual e privado</p>
        </div>
        <button onClick={onClose} aria-label="Fechar" className="opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !isBusy && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Diz-nos o que se passa. Se não conseguirmos resolver, passamos para a equipa no WhatsApp.
          </p>
        )}
        {messages.map((m) => {
          const text = messageText(m).replace(HUMAN_MARKER, "").trim();
          if (!text) return null;
          return (
            <div
              key={m.id}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] text-sm leading-relaxed",
                  m.role === "user"
                    ? "rounded-2xl bg-primary px-3 py-2 text-primary-foreground"
                    : "text-foreground",
                )}
              >
                {m.role === "user" ? (
                  text
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:my-1">
                    <ReactMarkdown>{text}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {status === "submitted" && (
          <p className="text-sm text-muted-foreground">A escrever…</p>
        )}
        {error && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Não foi possível contactar o suporte. Tenta novamente ou fala connosco no WhatsApp.
          </p>
        )}
        {(needsHuman || error) && (
          <a
            href={whatsappLink(
              `Olá! Preciso de ajuda no MM Club.${
                lastUserText ? `\n\nO meu pedido: ${messageText(lastUserText)}` : ""
              }`,
            )}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-3 text-sm font-medium text-background transition hover:opacity-90"
          >
            Falar com a equipa no WhatsApp
          </a>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface-1 px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Escreve a tua mensagem…"
            className="max-h-28 min-h-6 flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || isBusy}
            aria-label="Enviar"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={() => window.open(whatsappLink("Olá! Preciso de ajuda no MM Club."), "_blank")}
          className="mt-2 w-full text-center text-xs text-muted-foreground transition hover:text-foreground"
        >
          Prefiro falar com uma pessoa no WhatsApp
        </button>
      </div>
    </div>
  );
}
