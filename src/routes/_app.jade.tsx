import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
import { ArrowUp, Plus, Bot, Square } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/jade")({
  head: () => ({
    meta: [
      { title: "Suporte IA — MM Club" },
      {
        name: "description",
        content:
          "Suporte IA do MM Club: pergunte sobre marca, marketing, vendas, escala e liderança.",
      },
    ],
  }),
  component: SuporteIAPage,
});

const suggestions = [
  "Como posiciono a minha marca pessoal num nicho saturado?",
  "Dá-me uma estrutura para uma oferta premium.",
  "Como escrever uma bio que converte no Instagram?",
  "Quais métricas devo acompanhar todas as semanas?",
];

function SuporteIAPage() {
  const [chatId, setChatId] = useState(() => `c-${Date.now()}`);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    [],
  );

  const { messages, sendMessage, status, stop, error, setMessages } = useChat({
    id: chatId,
    transport,
  });

  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [chatId]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    setInput("");
    void sendMessage({ text: trimmed });
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function newConversation() {
    stop();
    setMessages([]);
    setChatId(`c-${Date.now()}`);
    setInput("");
  }

  return (
    <div className="-mx-3 -my-4 flex h-[calc(100vh-8rem)] flex-col sm:-mx-4 sm:-my-6 md:-mx-8 md:-my-8 md:h-[calc(100vh-4rem)]">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-8 md:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-[color:var(--hairline)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-lg text-foreground">Suporte IA</h1>
            <p className="text-xs text-muted-foreground">
              Marca, marketing, vendas e escala.
            </p>
          </div>
        </div>
        <button
          onClick={newConversation}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-2"
        >
          <Plus className="h-3.5 w-3.5" /> Nova conversa
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-2xl space-y-6">
          {messages.length === 0 && (
            <div className="space-y-6 py-8 text-center md:py-12">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-[color:var(--hairline)]">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-2xl text-foreground">
                  Como te posso ajudar?
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Pergunta sobre marca, marketing, vendas, escala ou liderança.
                </p>
              </div>
              <div className="mx-auto grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-xl border border-border bg-surface-1 px-4 py-3 text-left text-sm text-foreground transition hover:border-[color:var(--hairline)] hover:bg-surface-2"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <Bubble key={m.id} message={m} />
          ))}

          {status === "submitted" && <TypingIndicator />}

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Ocorreu um erro ao contactar o Suporte IA. Tenta novamente.
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border bg-background/80 px-4 py-3 backdrop-blur-xl md:px-8 md:py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex max-w-2xl items-end gap-3 rounded-2xl bg-surface-1 p-2 ring-1 ring-border transition focus-within:ring-[color:var(--hairline)]"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Escreve a tua pergunta…"
            className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            autoFocus
          />
          {isBusy ? (
            <button
              type="button"
              onClick={() => stop()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-foreground ring-1 ring-border transition hover:bg-surface-3"
              aria-label="Parar"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:bg-gold-soft disabled:opacity-40"
              aria-label="Enviar"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </form>
        <p className="mx-auto mt-2 max-w-2xl text-center text-[10px] text-muted-foreground">
          Suporte IA pode cometer erros. Verifica informação importante.
        </p>
      </div>
    </div>
  );
}

function messageText(m: UIMessage): string {
  return m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("");
}

function Bubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = messageText(message);
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "whitespace-pre-wrap bg-primary text-primary-foreground"
            : "bg-surface-1 text-foreground ring-1 ring-border",
        )}
      >
        {isUser ? (
          text
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-headings:font-display prose-headings:text-foreground prose-strong:text-primary prose-a:text-primary">
            <ReactMarkdown>{text || "…"}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl bg-surface-1 px-4 py-3 ring-1 ring-border">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
      </div>
    </div>
  );
}
