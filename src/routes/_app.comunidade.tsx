import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect } from "react";
import { Search, Send, Paperclip, Smile, Phone, Video, MoreVertical, Check, CheckCheck, Pin, ArrowLeft } from "lucide-react";
import { conversations, threads, type Message } from "@/data/messages";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/comunidade")({
  head: () => ({
    meta: [
      { title: "Comunidade — MM Club" },
      {
        name: "description",
        content:
          "Troca mensagens directamente com o fundador e outros membros da Marca Milionária.",
      },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const [activeId, setActiveId] = useState(conversations[0].id);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [localThreads, setLocalThreads] = useState(threads);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const filtered = useMemo(
    () =>
      conversations.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  const active = conversations.find((c) => c.id === activeId)!;
  const messages = localThreads[activeId] ?? [];

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, activeId]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    const msg: Message = {
      id: `${activeId}-${Date.now()}`,
      author: "me",
      text,
      time: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };
    setLocalThreads((prev) => ({
      ...prev,
      [activeId]: [...(prev[activeId] ?? []), msg],
    }));
    setDraft("");
  }

  function openConversation(id: string) {
    setActiveId(id);
    setMobileView("chat");
  }

  return (
    <div className="-mx-4 md:-mx-0">
      <header className="mb-6 px-4 md:px-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-primary">
          Comunidade
        </p>
        <h1 className="mt-2 font-display text-3xl text-foreground md:text-4xl">
          Mensagens
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Fala directamente com o fundador e outros membros. Networking real, em privado.
        </p>
      </header>

      <div className="grid overflow-hidden rounded-none border-y border-border bg-surface-1 md:grid-cols-[320px_1fr] md:rounded-2xl md:border md:ring-1 md:ring-border">
        {/* Sidebar */}
        <aside
          className={cn(
            "flex min-h-[70vh] flex-col border-border bg-surface-1 md:min-h-[75vh] md:border-r",
            mobileView === "chat" ? "hidden md:flex" : "flex",
          )}
        >
          <div className="border-b border-border p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Procurar conversas"
                className="w-full rounded-full border border-border bg-surface-2 py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <ul className="p-2">
              {filtered.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => openConversation(c.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl p-3 text-left transition",
                        isActive
                          ? "bg-surface-2 ring-1 ring-primary/30"
                          : "hover:bg-surface-2/60",
                      )}
                    >
                      <div className="relative shrink-0">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary ring-1 ring-[color:var(--hairline)]">
                          {c.initials}
                        </div>
                        {c.online && (
                          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-surface-1" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                          {c.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                          <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                            {c.timeAgo}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.role}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <p className="truncate text-xs text-muted-foreground">{c.lastMessage}</p>
                          {c.unread ? (
                            <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                              {c.unread}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="p-6 text-center text-xs text-muted-foreground">
                  Sem resultados para "{query}".
                </li>
              )}
            </ul>
          </div>
        </aside>

        {/* Chat */}
        <section
          className={cn(
            "flex min-h-[70vh] flex-col md:min-h-[75vh]",
            mobileView === "list" ? "hidden md:flex" : "flex",
          )}
        >
          {/* Chat header */}
          <div className="flex items-center gap-3 border-b border-border bg-surface-1 px-4 py-3 md:px-6 md:py-4">
            <button
              type="button"
              onClick={() => setMobileView("list")}
              className="rounded-full p-1.5 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground md:hidden"
              aria-label="Voltar às conversas"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="relative shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary ring-1 ring-[color:var(--hairline)]">
                {active.initials}
              </div>
              {active.online && (
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-surface-1" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{active.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {active.online ? "Online agora" : active.role}
              </p>
            </div>
            <div className="hidden items-center gap-1 md:flex">
              <IconBtn label="Chamada"><Phone className="h-4 w-4" /></IconBtn>
              <IconBtn label="Vídeo"><Video className="h-4 w-4" /></IconBtn>
              <IconBtn label="Mais"><MoreVertical className="h-4 w-4" /></IconBtn>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto bg-[color:var(--surface-base,theme(colors.background))] px-4 py-6 md:px-8"
          >
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              <DateDivider label="Hoje" />
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const grouped = prev && prev.author === m.author;
                return (
                  <MessageBubble key={m.id} message={m} grouped={grouped} />
                );
              })}
            </div>
          </div>

          {/* Composer */}
          <div className="border-t border-border bg-surface-1 px-3 py-3 md:px-6 md:py-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border border-border bg-surface-2 p-2"
            >
              <IconBtn label="Anexar"><Paperclip className="h-4 w-4" /></IconBtn>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder={`Mensagem para ${active.name.split(" ")[0]}…`}
                className="max-h-32 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <IconBtn label="Emoji"><Smile className="h-4 w-4" /></IconBtn>
              <button
                type="submit"
                disabled={!draft.trim()}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="mx-auto mt-2 max-w-2xl px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Enter para enviar · Shift+Enter para nova linha
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function IconBtn({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
    >
      {children}
    </button>
  );
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="my-2 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function MessageBubble({ message, grouped }: { message: Message; grouped: boolean }) {
  const mine = message.author === "me";
  return (
    <div
      className={cn(
        "flex w-full",
        mine ? "justify-end" : "justify-start",
        grouped ? "mt-0.5" : "mt-2",
      )}
    >
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
          mine
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-surface-2 text-foreground ring-1 ring-border",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-[10px]",
            mine ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          <span>{message.time}</span>
          {mine && message.status === "read" && <CheckCheck className="h-3 w-3" />}
          {mine && message.status === "delivered" && <CheckCheck className="h-3 w-3 opacity-60" />}
          {mine && message.status === "sent" && <Check className="h-3 w-3 opacity-60" />}
        </div>
      </div>
    </div>
  );
}
