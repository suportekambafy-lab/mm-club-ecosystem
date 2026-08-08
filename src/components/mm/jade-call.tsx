import { useEffect, useRef, useState } from "react";
import { PhoneOff, Mic, MicOff, Loader2, AudioLines } from "lucide-react";
import { cn } from "@/lib/utils";
import { authHeaders } from "@/lib/auth-headers";

type Status = "connecting" | "live" | "ended" | "error";

export function JadeCallOverlay({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<Status>("connecting");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [caption, setCaption] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const tokenRes = await fetch("/api/realtime/session", {
          method: "POST",
          headers: await authHeaders(),
        });
        if (!tokenRes.ok) throw new Error(await tokenRes.text());
        const session = await tokenRes.json();
        const ephemeralKey: string | undefined = session?.client_secret?.value;
        const model: string = session?.model ?? "gpt-4o-realtime-preview-2024-12-17";
        if (!ephemeralKey) throw new Error("Sessão inválida");
        if (cancelled) return;

        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        const audioEl = document.createElement("audio");
        audioEl.autoplay = true;
        audioEl.setAttribute("playsinline", "");
        audioElRef.current = audioEl;

        pc.ontrack = (e) => {
          audioEl.srcObject = e.streams[0];
          try {
            const AC = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AC();
            audioCtxRef.current = ctx;
            const src = ctx.createMediaStreamSource(e.streams[0]);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            src.connect(analyser);
            analyserRef.current = analyser;
            const data = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
              analyser.getByteTimeDomainData(data);
              let sum = 0;
              for (let i = 0; i < data.length; i++) {
                const v = (data[i] - 128) / 128;
                sum += v * v;
              }
              const rms = Math.sqrt(sum / data.length);
              setSpeaking(rms > 0.04);
              rafRef.current = requestAnimationFrame(tick);
            };
            tick();
          } catch {}
        };

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;
        dc.onmessage = (e) => {
          try {
            const evt = JSON.parse(e.data);
            if (evt.type === "response.audio_transcript.delta" && evt.delta) {
              setCaption((c) => (c + evt.delta).slice(-240));
            } else if (evt.type === "response.audio_transcript.done") {
              setTimeout(() => setCaption(""), 2500);
            } else if (evt.type === "input_audio_buffer.speech_started") {
              setCaption("");
            } else if (
              evt.type === "response.function_call_arguments.done" ||
              (evt.type === "response.output_item.done" &&
                evt.item?.type === "function_call")
            ) {
              const item = evt.item ?? evt;
              const name = item.name ?? evt.name;
              const callId = item.call_id ?? evt.call_id;
              const argsRaw = item.arguments ?? evt.arguments ?? "{}";
              if (name === "search_mm_knowledge" && callId) {
                void handleKnowledgeCall(callId, argsRaw);
              }
            }
          } catch {}
        };

        async function handleKnowledgeCall(callId: string, argsRaw: string) {
          let query = "";
          try {
            const parsed = JSON.parse(argsRaw);
            query = typeof parsed?.query === "string" ? parsed.query : "";
          } catch {}
          let output = "";
          try {
            const r = await fetch("/api/knowledge/search", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...(await authHeaders()) },
              body: JSON.stringify({ query, match_count: 6 }),
            });
            if (r.ok) {
              const data = (await r.json()) as {
                results?: Array<{ course?: string | null; lesson?: string | null; content?: string }>;
              };
              const results = data.results ?? [];
              output = results.length
                ? results
                    .map((m, i) => {
                      const label = [m.course, m.lesson].filter(Boolean).join(" · ") || "Aula";
                      return `[${i + 1}] ${label}\n${m.content ?? ""}`;
                    })
                    .join("\n\n")
                : "Sem resultados relevantes na memória das aulas.";
            } else {
              output = "Sem resultados.";
            }
          } catch {
            output = "Sem resultados.";
          }
          try {
            dc.send(
              JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: callId,
                  output,
                },
              }),
            );
            dc.send(JSON.stringify({ type: "response.create" }));
          } catch {}
        }


        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpRes = await fetch(`https://api.openai.com/v1/realtime/calls?model=${model}`, {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp",
          },
        });
        if (!sdpRes.ok) throw new Error(`SDP ${sdpRes.status}`);
        const answer = { type: "answer" as const, sdp: await sdpRes.text() };
        await pc.setRemoteDescription(answer);

        if (cancelled) return;
        setStatus("live");
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Falha ao ligar");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== "live") return;
    const t = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  function cleanup() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try { audioCtxRef.current?.close(); } catch {}
    audioCtxRef.current = null;
    analyserRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    try { dcRef.current?.close(); } catch {}
    dcRef.current = null;
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }
  }

  function toggleMute() {
    const s = localStreamRef.current;
    if (!s) return;
    const next = !muted;
    s.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }

  function hangup() {
    cleanup();
    setStatus("ended");
    onClose();
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-background/95 px-6 pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] backdrop-blur-2xl">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {status === "connecting" && "A ligar…"}
          {status === "live" && "Em chamada"}
          {status === "error" && "Falha na chamada"}
          {status === "ended" && "Chamada terminada"}
        </p>
        <h2 className="mt-2 font-display text-2xl text-foreground">MM Inteligence</h2>
        {status === "live" && (
          <p className="mt-1 text-sm tabular-nums text-muted-foreground">{mm}:{ss}</p>
        )}
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        <div
          className={cn(
            "absolute h-64 w-64 rounded-full bg-primary/20 blur-3xl transition-all duration-500",
            speaking ? "scale-125 opacity-100" : "scale-100 opacity-50",
          )}
        />
        <div
          className={cn(
            "absolute h-48 w-48 rounded-full bg-primary/30 blur-2xl transition-all duration-300",
            speaking ? "scale-110" : "scale-95",
          )}
        />
        <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary/40 ring-1 ring-primary/50 shadow-2xl">
          {status === "connecting" ? (
            <Loader2 className="h-10 w-10 animate-spin text-primary-foreground" />
          ) : (
            <AudioLines className={cn("h-14 w-14 text-primary-foreground transition-transform", speaking && "scale-110")} />
          )}
        </div>
      </div>

      <div className="w-full max-w-md space-y-6">
        {caption && (
          <p className="min-h-[3rem] text-center text-sm leading-relaxed text-foreground/80">
            {caption}
          </p>
        )}
        {error && (
          <p className="text-center text-sm text-destructive">{error}</p>
        )}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={toggleMute}
            disabled={status !== "live"}
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full ring-1 transition disabled:opacity-40",
              muted
                ? "bg-surface-2 text-muted-foreground ring-border"
                : "bg-surface-1 text-foreground ring-border hover:bg-surface-2",
            )}
            aria-label={muted ? "Ativar microfone" : "Silenciar microfone"}
          >
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button
            onClick={hangup}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-white shadow-lg ring-1 ring-destructive/50 transition hover:brightness-110"
            aria-label="Terminar chamada"
          >
            <PhoneOff className="h-6 w-6" />
          </button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground">
          Chamada em tempo real • áudio processado por MM Inteligence
        </p>
      </div>
    </div>
  );
}
