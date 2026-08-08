import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Square, Mic, Loader2, Phone, Copy, Check } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { authHeaders } from "@/lib/auth-headers";
import { JadeCallOverlay } from "@/components/mm/jade-call";

const suggestions = [
  "Como posiciono a minha marca pessoal num nicho saturado?",
  "Dá-me uma estrutura para uma oferta premium.",
  "Como escrever uma bio que converte no Instagram?",
  "Quais métricas devo acompanhar todas as semanas?",
];

export function JadeChat({
  threadId,
  initialMessages,
  onTitleChanged,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  onTitleChanged?: () => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [callOpen, setCallOpen] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: () => authHeaders(),
        body: { threadId },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: initialMessages,
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
  }, [threadId]);

  // Quando termina uma resposta, o título da conversa pode ter sido gerado.
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !isBusy) onTitleChanged?.();
    wasBusy.current = isBusy;
  }, [isBusy, onTitleChanged]);

  // Lock page scroll so only the messages container scrolls (native app feel).
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const prevOverscroll = body.style.overscrollBehavior;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      body.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    setInput("");
    void sendMessage({ text: trimmed });
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function pickMimeType(): string {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
    for (const t of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
  }

  async function startRecording() {
    setRecError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (blob.size < 2048) {
          setRecError("Gravação demasiado curta. Tenta novamente.");
          setIsTranscribing(false);
          return;
        }
        await transcribeAndFill(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      setRecError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Permissão do microfone negada."
          : "Não foi possível iniciar a gravação.",
      );
    }
  }

  function stopRecording() {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      setIsRecording(false);
      setIsTranscribing(true);
      rec.stop();
    }
  }

  async function transcribeAndFill(blob: Blob) {
    try {
      const form = new FormData();
      const ext = (blob.type.split(";")[0].split("/")[1] || "webm").replace("mpeg", "mp3");
      form.append("file", blob, `recording.${ext}`);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
        headers: await authHeaders(),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Falha na transcrição (${res.status})`);
      }
      const data = (await res.json()) as { text?: string };
      const text = (data.text ?? "").trim();
      if (!text) {
        setRecError("Não foi possível transcrever o áudio.");
        return;
      }
      setInput((prev) => (prev ? `${prev} ${text}` : text));
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (e) {
      setRecError(e instanceof Error ? e.message : "Erro ao transcrever.");
    } finally {
      setIsTranscribing(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 pl-14 md:py-4 lg:px-8 lg:pl-8">
        <div className="min-w-0">
          <h1 className="font-display text-lg text-foreground">MM Inteligente</h1>
          <p className="text-xs text-muted-foreground">Marca, marketing, vendas e escala.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCallOpen(true)}
            aria-label="Chamada"
            title="Chamada"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-gold-soft"
          >
            <Phone className="h-4 w-4" />
          </button>
        </div>
      </header>
      {callOpen && <JadeCallOverlay onClose={() => setCallOpen(false)} />}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-2xl space-y-6">
          {messages.length === 0 && (
            <div className="space-y-6 py-8 text-center md:py-12">
              <div>
                <h2 className="font-display text-2xl text-foreground">Como te posso ajudar?</h2>
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

          {messages.map((m, i) => (
            <Bubble
              key={m.id}
              message={m}
              onPick={send}
              interactive={!isBusy && i === messages.length - 1}
              streaming={isBusy && i === messages.length - 1}
            />
          ))}

          {status === "submitted" && <TypingIndicator />}

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Ocorreu um erro ao contactar o MM Inteligente. Tenta novamente.
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border bg-background/80 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+7.5rem)] backdrop-blur-xl md:px-8 md:pt-4 md:pb-4">
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
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {!isBusy && (
            <button
              type="button"
              onClick={() => (isRecording ? stopRecording() : void startRecording())}
              disabled={isTranscribing}
              aria-label={isRecording ? "Parar gravação" : "Falar"}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-border transition disabled:opacity-50",
                isRecording
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-surface-2 text-foreground hover:bg-surface-3",
              )}
            >
              {isTranscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isRecording ? (
                <Square className="h-3.5 w-3.5" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
          )}
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
        {recError && (
          <p className="mx-auto mt-2 max-w-2xl text-center text-[11px] text-destructive">
            {recError}
          </p>
        )}
        <p className="mx-auto mt-2 max-w-2xl text-center text-[10px] text-muted-foreground">
          MM Inteligente pode cometer erros. Verifica informação importante.
        </p>
      </div>
    </div>
  );
}

function messageText(m: UIMessage): string {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

const OPTION_RE = /\[\[([^\]\n]{1,80})\]\]/g;

function splitOptions(raw: string): { text: string; options: string[] } {
  const options: string[] = [];
  for (const m of raw.matchAll(OPTION_RE)) {
    const value = m[1].trim();
    if (value && !options.includes(value)) options.push(value);
  }
  const text = raw
    .replace(OPTION_RE, "")
    .replace(/^[\s]*[-•*]\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, options: options.slice(0, 5) };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
      aria-label="Copiar resposta"
      title={copied ? "Copiado" : "Copiar"}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
    >
      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

function Bubble({
  message,
  onPick,
  interactive,
  streaming,
}: {
  message: UIMessage;
  onPick?: (text: string) => void;
  interactive?: boolean;
  streaming?: boolean;
}) {
  const isUser = message.role === "user";
  const raw = messageText(message);
  const { text, options } = isUser ? { text: raw, options: [] as string[] } : splitOptions(raw);
  return (
    <div className={cn("group flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
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
      {!isUser && !streaming && text && <CopyButton text={text} />}
      {!isUser && options.length > 0 && (
        <div className="flex max-w-[95%] flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={!interactive}
              onClick={() => onPick?.(opt)}
              className="rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary hover:text-primary-foreground disabled:opacity-40"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
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
