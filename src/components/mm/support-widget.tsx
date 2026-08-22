import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ChevronRight, Headset, Search, Send, X } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMySupportConversation } from "@/lib/support-my.functions";
import { cn } from "@/lib/utils";
import { authHeaders } from "@/lib/auth-headers";
import { SUPPORT_TOPICS, whatsappLink } from "@/lib/support-config";

const HUMAN_MARKER = "[[HUMANO]]";

/**
 * Transforma caminhos internos escritos em texto simples ou em `code`
 * (ex: /subscricao) em links markdown clicáveis.
 */
function linkifyRoutes(text: string): string {
  return text
    .replace(/`(\/[a-z0-9\-/]{2,})`/gi, "[$1]($1)")
    .replace(
      /(^|\s)(\/[a-z0-9\-]+(?:\/[a-z0-9\-]+)*)(?=[\s.,;:!?]|$)/gi,
      (_match, pre: string, path: string) => `${pre}[${path}](${path})`,
    );
}

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

  const historyFn = useServerFn(getMySupportConversation);
  const history = useQuery({
    queryKey: ["support", "my-conversation"],
    queryFn: () => historyFn(),
    enabled: open,
    staleTime: 0,
  });
  const savedMessages: UIMessage[] = useMemo(
    () =>
      (history.data ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        parts: [{ type: "text" as const, text: m.content }],
      })),
    [history.data],
  );
  const lastSaved = (history.data ?? []).at(-1)?.content ?? null;

  function openChat(prompt?: string) {
    setPending(prompt ?? null);
    setView("chat");
  }

  return (
    <>
      {open && (
        <div className="fixed inset-x-2 top-3 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-[70] flex justify-end sm:inset-x-auto sm:top-auto sm:right-5 sm:bottom-24">
          <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl sm:h-auto sm:max-h-[min(80vh,760px)] sm:w-[440px]">
            {view === "home" ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="relative z-10 shrink-0 rounded-t-3xl bg-foreground px-4 pt-4 pb-7 text-background sm:px-5 sm:pt-5 sm:pb-8">
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
                  <p className="mt-4 font-display text-xl opacity-60 sm:mt-6 sm:text-2xl">
                    Olá{firstName ? ` ${firstName}` : ""} 👋
                  </p>
                  <h2 className="font-display text-xl sm:text-2xl">Como podemos ajudar?</h2>
                </div>

                <div className="relative z-0 -mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 pb-4">
                  {savedMessages.length > 0 && (
                    <button
                      onClick={() => openChat()}
                      className="flex w-full items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-left transition hover:bg-primary/15"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-base text-foreground">
                          Continuar conversa
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {lastSaved}
                        </span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-primary" />
                    </button>
                  )}

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
                </div>
              </div>
            ) : (
              <SupportChat
                key={`suporte-${savedMessages.length}`}
                savedMessages={savedMessages}
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
        className="fixed right-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[70] inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background shadow-2xl transition hover:opacity-90 sm:right-5 sm:bottom-5"
      >
        {open ? <X className="h-4 w-4" /> : <Headset className="h-4 w-4" />}
        Suporte
      </button>
    </>
  );
}

function SupportChat({
  savedMessages,
  initialPrompt,
  onConsumePrompt,
  onBack,
  onClose,
}: {
  savedMessages: UIMessage[];
  initialPrompt: string | null;
  onConsumePrompt: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/support", headers: () => authHeaders() }),
    [],
  );
  const { messages, sendMessage, status, error } = useChat({
    id: "mm-suporte",
    messages: savedMessages,
    transport,
  });
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

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
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
                  "max-w-[88%] text-sm leading-relaxed sm:max-w-[85%]",
                  m.role === "user"
                    ? "rounded-2xl bg-primary px-3 py-2 text-primary-foreground"
                    : "text-foreground",
                )}
              >
                {m.role === "user" ? (
                  text
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:my-1">
                    <ReactMarkdown
                      components={{
                        a: ({ href, children }) => {
                          const to = typeof href === "string" ? href : "";
                          if (to.startsWith("/")) {
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  void navigate({ to: to as never });
                                }}
                                className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary no-underline transition hover:bg-primary/25"
                              >
                                {children}
                                <ChevronRight className="h-3 w-3" />
                              </button>
                            );
                          }
                          return (
                            <a href={to} target="_blank" rel="noreferrer">
                              {children}
                            </a>
                          );
                        },
                      }}
                    >
                      {linkifyRoutes(text)}
                    </ReactMarkdown>
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

      <div className="border-t border-border p-3 sm:p-4">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface-1 px-3 py-2 sm:px-4 sm:py-3">
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
            className="max-h-32 min-h-7 flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || isBusy}
            aria-label="Enviar"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition disabled:opacity-40"
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
