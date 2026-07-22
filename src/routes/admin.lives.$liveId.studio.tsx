import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Radio,
  Loader2,
  Mic,
  MicOff,
  Video,
  VideoOff,
  ExternalLink,
  AlertTriangle,
  MonitorUp,
  MonitorOff,
} from "lucide-react";
import { SectionHeading } from "@/components/mm/section-heading";
import { LiveChat } from "@/components/mm/live-chat";
import { supabase } from "@/integrations/supabase/client";
import { adminGetLiveIngest, adminSetLiveBroadcastState } from "@/lib/lives.functions";

export const Route = createFileRoute("/admin/lives/$liveId/studio")({
  component: LiveStudio,
});

type Status = "idle" | "requesting-media" | "ready" | "connecting" | "live" | "ended" | "error";

function LiveStudio() {
  const { liveId } = Route.useParams();
  const getIngest = useServerFn(adminGetLiveIngest);
  const setBroadcastState = useServerFn(adminSetLiveBroadcastState);

  const [whipUrl, setWhipUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number | null>(null);

  // Detect if we're running inside an iframe (e.g. Lovable preview) — many
  // preview iframes disable getUserMedia via Permissions-Policy, so we surface
  // a clear "abrir em nova janela" affordance before the user hits an opaque
  // NotAllowedError.
  const [inIframe, setInIframe] = useState(false);
  useEffect(() => {
    try {
      setInIframe(window.self !== window.top);
    } catch {
      setInIframe(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await getIngest({ data: { id: liveId } });
        if (!r?.cf_webrtc_url) {
          setError("Esta live não tem URL WebRTC. Cria uma nova live (as antigas só têm RTMPS).");
          setStatus("error");
          return;
        }
        setWhipUrl(r.cf_webrtc_url);
      } catch (e) {
        setError((e as Error).message);
        setStatus("error");
      }
    })();
    return () => teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveId]);

  useEffect(() => {
    if (status !== "live") return;
    startedAtRef.current = Date.now();
    const t = setInterval(() => {
      if (startedAtRef.current) setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  async function requestMedia() {
    setError(null);
    setStatus("requesting-media");
    try {
      if (!window.isSecureContext) {
        throw new Error("A página tem de estar em HTTPS para aceder à câmara/microfone.");
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "O navegador ou o preview em iframe está a bloquear a câmara. Abre esta página numa janela nova.",
        );
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStatus("ready");
    } catch (e) {
      const err = e as DOMException & { name?: string; message?: string };
      let msg = err.message || String(err);
      if (err.name === "NotAllowedError") {
        msg = inIframe
          ? "Acesso à câmara/microfone bloqueado pelo preview do Lovable. Abre esta página numa janela nova e tenta de novo."
          : "Permissão negada. Autoriza câmara e microfone nas definições do navegador.";
      } else if (err.name === "NotFoundError") {
        msg = "Não foi encontrada uma câmara ou microfone neste dispositivo.";
      } else if (err.name === "NotReadableError") {
        msg = "A câmara/microfone está a ser usada por outra aplicação.";
      }
      setError(msg);
      setStatus("error");
    }
  }

  async function goLive() {
    if (!whipUrl || !streamRef.current) return;
    setError(null);
    setStatus("connecting");
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
        bundlePolicy: "max-bundle",
      });
      pcRef.current = pc;

      for (const track of streamRef.current.getTracks()) {
        pc.addTransceiver(track, { direction: "sendonly", streams: [streamRef.current] });
      }

      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        if (s === "connected" || s === "completed") setStatus("live");
        if (s === "failed" || s === "disconnected") {
          setStatus("error");
          setError("Ligação WebRTC perdida.");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete so the SDP has candidates (Cloudflare WHIP prefers this).
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") return resolve();
        const check = () => {
          if (pc.iceGatheringState === "complete") {
            pc.removeEventListener("icegatheringstatechange", check);
            resolve();
          }
        };
        pc.addEventListener("icegatheringstatechange", check);
        setTimeout(() => resolve(), 2000);
      });

      const res = await fetch(whipUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription?.sdp ?? "",
      });
      if (!res.ok) {
        throw new Error(`WHIP HTTP ${res.status}: ${await res.text().catch(() => res.statusText)}`);
      }
      setStatus("live");
      await setBroadcastState({ data: { id: liveId, status: "live" } }).catch((err) => {
        console.error("[live-studio] failed to mark live", err);
      });
      const answerSdp = await readTextWithTimeout(res, 5000);
      if (answerSdp.trim()) {
        pc.setRemoteDescription({ type: "answer", sdp: answerSdp }).catch((err) => {
          console.error("[live-studio] failed to apply WebRTC answer", err);
        });
      }
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
      teardown();
    }
  }

  async function readTextWithTimeout(res: Response, ms: number) {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        res.text(),
        new Promise<string>((resolve) => {
          timeoutId = setTimeout(() => resolve(""), ms);
        }),
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  function toggleMic() {
    const t = streamRef.current?.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setMicOn(t.enabled);
  }

  function toggleCam() {
    const t = streamRef.current?.getVideoTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setCamOn(t.enabled);
  }

  function teardown() {
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    startedAtRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function endLive() {
    teardown();
    setStatus("ended");
    setElapsed(0);
    await setBroadcastState({ data: { id: liveId, status: "ended" } }).catch((err) => {
      console.error("[live-studio] failed to mark ended", err);
    });
  }

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/admin/lives"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
      </div>

      <SectionHeading
        eyebrow="Admin › Lives › Estúdio"
        title="Transmitir do navegador."
        description="Câmara e microfone deste dispositivo enviam directamente para o Cloudflare Stream via WebRTC (WHIP)."
      />

      {inIframe && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Estás a ver isto dentro do preview.</p>
              <p className="text-amber-100/80">
                O preview em iframe bloqueia o acesso à câmara/microfone. Abre esta página numa
                janela nova para transmitir.
              </p>
            </div>
          </div>
          <a
            href={typeof window !== "undefined" ? window.location.href : "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-xs font-medium text-black hover:bg-amber-400"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir em nova janela
          </a>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-black">
            <div className="relative aspect-video w-full">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
              />

              {status === "idle" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 text-center">
                  <Video className="h-8 w-8 text-primary" />
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Vai ser pedido acesso à câmara e ao microfone.
                  </p>
                  <button
                    type="button"
                    onClick={requestMedia}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
                  >
                    Activar câmara & microfone
                  </button>
                </div>
              )}

              {status === "requesting-media" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}

              {(status === "live" || status === "connecting") && (
                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-500/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  {status === "live" ? `AO VIVO · ${mmss}` : "A ligar…"}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-1 px-5 py-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={!streamRef.current}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:border-primary/40 disabled:opacity-40"
                  title={micOn ? "Silenciar micro" : "Ativar micro"}
                >
                  {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-red-300" />}
                </button>
                <button
                  type="button"
                  onClick={toggleCam}
                  disabled={!streamRef.current}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:border-primary/40 disabled:opacity-40"
                  title={camOn ? "Desligar câmara" : "Ligar câmara"}
                >
                  {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4 text-red-300" />}
                </button>
              </div>

              <div className="flex items-center gap-2">
                {status === "ready" && (
                  <button
                    type="button"
                    onClick={goLive}
                    disabled={!whipUrl}
                    className="inline-flex items-center gap-2 rounded-full bg-red-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60"
                  >
                    <Radio className="h-4 w-4" /> Ir para o ar
                  </button>
                )}
                {status === "connecting" && (
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> A negociar WebRTC…
                  </span>
                )}
                {status === "live" && (
                  <button
                    type="button"
                    onClick={endLive}
                    className="inline-flex items-center gap-2 rounded-full border border-red-500/40 px-5 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/10"
                  >
                    Terminar transmissão
                  </button>
                )}
                {status === "ended" && (
                  <span className="text-xs text-muted-foreground">
                    Transmissão terminada. A gravação será publicada automaticamente.
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface-1 p-5 text-xs text-muted-foreground">
            <p className="mb-2 font-display text-sm text-foreground">Como funciona</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>A câmara/micro deste separador ligam-se ao Cloudflare Stream via WebRTC (WHIP).</li>
              <li>Os alunos vêem a live em <code className="rounded bg-surface-2 px-1">/lives/{liveId}</code> (HLS baixa latência).</li>
              <li>Ao terminar, a gravação fica automaticamente disponível na página da live.</li>
              <li>Não fechar o separador durante a transmissão. Se cair a rede, volta a esta página e prime <em>Ir para o ar</em>.</li>
            </ul>
          </div>
        </div>

        <aside className="xl:sticky xl:top-24 xl:h-[calc(100dvh-8rem)]">
          <LiveChat liveId={liveId} currentUserId={userId} />
        </aside>
      </div>
    </div>
  );
}
