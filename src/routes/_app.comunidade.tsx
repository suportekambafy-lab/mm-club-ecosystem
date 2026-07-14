import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect } from "react";
import {
  Search,
  Send,
  Paperclip,
  Image as ImageIcon,
  Mic,
  Phone,
  Video,
  MoreHorizontal,
  ChevronDown,
  Pin,
  MessageSquare,
  ArrowLeft,
  CheckCheck,
} from "lucide-react";
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

const FONT = { fontFamily: "'Spline Sans', 'Inter', system-ui, sans-serif" };

function CommunityPage() {
  const [activeId, setActiveId] = useState(conversations[0].id);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [localThreads, setLocalThreads] = useState(threads);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const active = conversations.find((c) => c.id === activeId)!;
  const pinned = conversations.filter((c) => c.pinned);
  const rest = useMemo(
    () =>
      conversations
        .filter((c) => !c.pinned)
        .filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const messages = localThreads[activeId] ?? [];

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, activeId]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    const msg: Message = {
      id: `${activeId}-${Date.now()}`,
      author: "me",
      text,
      time: new Date().toLocaleTimeString("pt-PT", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: "sent",
    };
    setLocalThreads((prev) => ({
      ...prev,
      [activeId]: [...(prev[activeId] ?? []), msg],
    }));
    setDraft("");
  }

  function open(id: string) {
    setActiveId(id);
    setMobileView("chat");
  }

  return (
    <div className="-mx-4 md:-mx-0" style={FONT}>
      {/* Navbar */}
      <div className="mb-6 hidden items-center justify-between rounded-2xl bg-surface-1 px-6 py-4 ring-1 ring-border md:flex">
        <h1 className="text-2xl font-semibold text-white" style={FONT}>
          As minhas mensagens
        </h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <RoundIcon><Search className="h-5 w-5" /></RoundIcon>
        </div>
      </div>

      {/* Mobile title */}
      <header className="mb-6 px-4 md:hidden">
        <h1 className="text-2xl font-semibold text-white" style={FONT}>
          Mensagens
        </h1>
      </header>

      <div className="grid overflow-hidden border-y border-border bg-surface-1 md:grid-cols-[380px_1fr] md:rounded-3xl md:border md:ring-1 md:ring-border">
        {/* ================= Sidebar ================= */}
        <aside
          className={cn(
            "flex min-h-[75vh] flex-col border-border bg-surface-1 md:min-h-[720px] md:border-r",
            mobileView === "chat" ? "hidden md:flex" : "flex",
          )}
        >
          {/* All Message title + filter */}
          <div className="flex items-center justify-between px-6 pt-6">
            <button
              type="button"
              className="flex items-center gap-2 text-lg font-semibold text-white"
              style={FONT}
            >
              Todas as mensagens
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              className="text-muted-foreground transition hover:text-foreground"
              aria-label="Mais opções"
            >
              <MoreHorizontal className="h-5 w-5 rotate-90" />
            </button>
          </div>

          {/* Search */}
          <div className="px-6 pt-5">
            <div className="flex items-center gap-2 rounded-lg border border-[#e8eaed]/30 px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Procurar mensagem…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                style={FONT}
              />
            </div>
          </div>

          {/* Pinned section */}
          {pinned.length > 0 && (
            <>
              <SectionLabel icon={<Pin className="h-4 w-4" />}>
                Fixadas
              </SectionLabel>
              <ul>
                {pinned.map((c) => (
                  <ConversationRow
                    key={c.id}
                    c={c}
                    active={c.id === activeId}
                    onClick={() => open(c.id)}
                    highlight
                  />
                ))}
              </ul>
            </>
          )}

          {/* All Messages section */}
          <SectionLabel icon={<MessageSquare className="h-4 w-4" />}>
            Todas as mensagens
          </SectionLabel>
          <div className="flex-1 overflow-y-auto pb-4">
            <ul>
              {rest.map((c) => (
                <ConversationRow
                  key={c.id}
                  c={c}
                  active={c.id === activeId}
                  onClick={() => open(c.id)}
                />
              ))}
              {rest.length === 0 && (
                <li className="px-6 py-8 text-center text-xs text-muted-foreground">
                  Sem resultados.
                </li>
              )}
            </ul>
          </div>
        </aside>

        {/* ================= Chat pane ================= */}
        <section
          className={cn(
            "flex min-h-[75vh] flex-col bg-[#282a2d] md:min-h-[720px] md:rounded-br-3xl",
            mobileView === "list" ? "hidden md:flex" : "flex",
          )}
        >
          {/* Chat header */}
          <div className="flex items-center gap-3 border-b border-white/5 bg-surface-1 px-4 py-4 md:rounded-tr-3xl md:px-6">
            <button
              type="button"
              onClick={() => setMobileView("list")}
              className="rounded-full p-1.5 text-muted-foreground transition hover:bg-white/5 hover:text-foreground md:hidden"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="relative shrink-0">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-base font-semibold text-primary ring-1 ring-[color:var(--hairline)]"
                style={FONT}
              >
                {active.initials}
              </div>
              {active.online && (
                <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-[#34c759] ring-2 ring-surface-1" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg text-white" style={FONT}>
                {active.name}
              </p>
              <p
                className={cn(
                  "truncate text-sm",
                  active.online ? "text-[#34c759]" : "text-muted-foreground",
                )}
                style={FONT}
              >
                {active.online ? "A escrever…" : active.role}
              </p>
            </div>
            <div className="hidden items-center gap-3 text-[#e8eaed] md:flex">
              <RoundIcon><Video className="h-5 w-5" /></RoundIcon>
              <RoundIcon><Phone className="h-5 w-5" /></RoundIcon>
              <RoundIcon><MoreHorizontal className="h-5 w-5" /></RoundIcon>
            </div>
          </div>

          {/* Messages wallpaper */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-8 md:px-10"
          >
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              {/* Date pill: white pill, black text (matches Figma) */}
              <div className="flex justify-center">
                <span
                  className="rounded-xl bg-white px-5 py-3 text-sm text-black"
                  style={FONT}
                >
                  Hoje, {new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}
                </span>
              </div>

              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const grouped = prev?.author === m.author;
                return (
                  <MessageBlock
                    key={m.id}
                    message={m}
                    grouped={grouped}
                    peer={active}
                  />
                );
              })}
            </div>
          </div>

          {/* Composer */}
          <div className="bg-surface-1 p-4 md:rounded-br-3xl md:p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="mx-auto flex max-w-3xl items-center gap-4"
            >
              <div className="flex flex-1 items-center gap-4 rounded-lg border border-[#e8eaed]/30 px-4 py-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Escreve uma mensagem…"
                  className="flex-1 bg-transparent text-base text-[#e8eaed] placeholder:text-[#e8eaed]/70 focus:outline-none"
                  style={FONT}
                />
                <button type="button" aria-label="Voz" className="text-[#e8eaed] transition hover:text-white">
                  <Mic className="h-5 w-5" />
                </button>
                <button type="button" aria-label="Imagem" className="text-[#e8eaed] transition hover:text-white">
                  <ImageIcon className="h-5 w-5" />
                </button>
                <button type="button" aria-label="Anexar" className="text-[#e8eaed] transition hover:text-white">
                  <Paperclip className="h-5 w-5" />
                </button>
              </div>
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Enviar"
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-5 w-5" />
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */

function RoundIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full text-[#e8eaed] transition hover:bg-white/5">
      {children}
    </span>
  );
}

function SectionLabel({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-6 pb-3 pt-6 text-[#bdc1c6]">
      {icon}
      <span className="text-sm" style={FONT}>
        {children}
      </span>
    </div>
  );
}

function ConversationRow({
  c,
  active,
  onClick,
  highlight,
}: {
  c: (typeof conversations)[number];
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 px-6 py-4 text-left transition",
          active
            ? "bg-[#3c4043]"
            : highlight
              ? "bg-white/[0.02] hover:bg-white/[0.04]"
              : "hover:bg-white/[0.03]",
        )}
      >
        <div className="relative shrink-0">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary ring-1 ring-[color:var(--hairline)]"
            style={FONT}
          >
            {c.initials}
          </div>
          {c.online && (
            <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-[#34c759] ring-2 ring-surface-1" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="min-w-0 flex-1 truncate text-base text-white" style={FONT}>
              {c.name}
            </p>
            <p className="shrink-0 text-xs text-[#bdc1c6]" style={FONT}>
              {c.timeAgo}
            </p>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <p
              className={cn(
                "min-w-0 flex-1 truncate text-sm",
                c.online && active ? "text-[#34c759]" : "text-[#e8eaed]/80",
              )}
              style={FONT}
            >
              {c.online && active ? "A escrever…" : c.lastMessage}
            </p>
            {c.unread ? (
              <span
                className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground"
                style={FONT}
              >
                {c.unread}
              </span>
            ) : null}
          </div>
        </div>
      </button>
    </li>
  );
}

function MessageBlock({
  message,
  grouped,
  peer,
}: {
  message: Message;
  grouped: boolean;
  peer: (typeof conversations)[number];
}) {
  const mine = message.author === "me";
  if (mine) {
    return (
      <div className={cn("flex items-start justify-end gap-4", grouped && "-mt-3")}>
        <div className="flex max-w-[70%] flex-col items-end gap-2">
          {!grouped && (
            <p className="text-base text-white" style={FONT}>
              Tu
            </p>
          )}
          <div className="flex items-end gap-2.5">
            <p className="text-sm text-[#9aa0a6]" style={FONT}>
              {message.time}
              {message.status === "read" && (
                <CheckCheck className="ml-1 inline h-3 w-3" />
              )}
            </p>
            <div
              className="rounded-xl bg-primary px-4 py-3 text-right text-sm text-primary-foreground"
              style={FONT}
            >
              {message.text}
            </div>
          </div>
        </div>
        <div
          className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary ring-1 ring-[color:var(--hairline)]"
          style={FONT}
        >
          Tu
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex items-start gap-4", grouped && "-mt-3")}>
      <div
        className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary ring-1 ring-[color:var(--hairline)]"
        style={FONT}
      >
        {peer.initials}
      </div>
      <div className="flex max-w-[70%] flex-col items-start gap-2">
        {!grouped && (
          <p className="text-base text-white" style={FONT}>
            {peer.name}
          </p>
        )}
        <div className="flex items-end gap-2.5">
          <div
            className="rounded-xl bg-[#3c4043] px-4 py-3 text-sm text-white"
            style={FONT}
          >
            {message.text}
          </div>
          <p className="text-sm text-[#9aa0a6]" style={FONT}>
            {message.time}
          </p>
        </div>
      </div>
    </div>
  );
}
