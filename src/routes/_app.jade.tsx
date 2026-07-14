import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { ArrowUp, Plus, Sparkles, MessageSquare } from "lucide-react";
import { jadeConversations, jadeSuggestions, type JadeMessage } from "@/data/jade";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/jade")({
  head: () => ({
    meta: [
      { title: "Jade — MM Club" },
      {
        name: "description",
        content:
          "Jade é a inteligência do MM Club. Treinada com a base de conhecimento da Marca Milionária.",
      },
    ],
  }),
  component: JadePage,
});

const mockResponses = [
  "Ótima pergunta. No método Marca Milionária, este ponto começa por definir com clareza o **valor percebido** que a tua marca entrega. Descreve-me em duas frases o teu produto e o teu cliente ideal para eu personalizar a resposta.",
  "Vamos por partes. Primeiro, vamos separar **execução** de **estratégia**. O que estás a resolver agora é um problema estratégico e a minha sugestão passa por três movimentos concretos.",
  "Perfeito. Aqui vai um framework MM que se aplica ao teu caso:\n\n1. **Contraste** — como te posicionas em oposição ao status quo\n2. **Origem** — a história que legitima o teu método\n3. **Método** — o processo próprio que só tu ensinas\n\nQueres que aprofunde algum destes eixos?",
];

function JadePage() {
  const [activeId, setActiveId] = useState(jadeConversations[0].id);
  const [conversations, setConversations] = useState(jadeConversations);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [active.messages.length, typing]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: JadeMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId ? { ...c, messages: [...c.messages, userMsg] } : c,
      ),
    );
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const reply: JadeMessage = {
        id: `j-${Date.now()}`,
        role: "jade",
        content: mockResponses[Math.floor(Math.random() * mockResponses.length)],
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId ? { ...c, messages: [...c.messages, reply] } : c,
        ),
      );
      setTyping(false);
    }, 900);
  }

  function newConversation() {
    const id = `jc-${Date.now()}`;
    setConversations((prev) => [
      { id, title: "Nova conversa", updatedAt: "agora", messages: [] },
      ...prev,
    ]);
    setActiveId(id);
  }

  return (
    <div className="-mx-4 -my-8 grid h-[calc(100vh-4rem)] grid-cols-1 md:-mx-8 md:-my-10 md:grid-cols-[280px_1fr]">
      {/* Sidebar de conversas */}
      <aside className="hidden flex-col border-r border-border bg-surface-1/50 md:flex">
        <div className="p-4">
          <button
            onClick={newConversation}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-gold-soft"
          >
            <Plus className="h-4 w-4" /> Nova conversa
          </button>
        </div>
        <div className="scrollbar-none flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition",
                c.id === activeId
                  ? "bg-surface-2 text-foreground ring-1 ring-[color:var(--hairline)]"
                  : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground",
              )}
            >
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate">{c.title}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {c.updatedAt}
                </p>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Thread */}
      <section className="flex min-w-0 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-[color:var(--hairline)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="font-display text-lg text-foreground">Jade</h1>
            <p className="text-xs text-muted-foreground">
              Treinada com a base de conhecimento MM
            </p>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-8 md:px-8">
          <div className="mx-auto max-w-2xl space-y-6">
            {active.messages.length === 0 && (
              <div className="space-y-6 py-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-[color:var(--hairline)]">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-display text-2xl text-foreground">
                    Como te posso ajudar?
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Pergunta sobre marca, IA, marketing, escala ou liderança.
                  </p>
                </div>
                <div className="mx-auto grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                  {jadeSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-xl border border-border bg-surface-1 px-4 py-3 text-left text-sm text-foreground transition hover:border-[color:var(--hairline)]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {active.messages.map((m) => (
              <Bubble key={m.id} message={m} />
            ))}
            {typing && <TypingIndicator />}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-background/80 px-4 py-4 backdrop-blur-xl md:px-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="mx-auto flex max-w-2xl items-end gap-3 rounded-2xl bg-surface-1 p-2 ring-1 ring-border transition focus-within:ring-[color:var(--hairline)]"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Pergunta à Jade…"
              className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:bg-gold-soft disabled:opacity-40"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </form>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[10px] text-muted-foreground">
            Jade responde com base na biblioteca do MM Club. Pode cometer erros.
          </p>
        </div>
      </section>
    </div>
  );
}

function Bubble({ message }: { message: JadeMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-surface-1 text-foreground ring-1 ring-border",
        )}
      >
        {message.content.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
          part.startsWith("**") ? (
            <strong key={i} className={isUser ? "" : "text-primary"}>
              {part.slice(2, -2)}
            </strong>
          ) : (
            <span key={i}>{part}</span>
          ),
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
