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
import {
  adminAttachReplayRecording,
  adminCreateReplayUpload,
  adminGetLiveIngest,
  adminSetLiveBroadcastState,
} from "@/lib/lives.functions";

export const Route = createFileRoute("/admin/lives/$liveId/studio")({
  component: LiveStudio,
});

type Status = "idle" | "requesting-media" | "ready" | "connecting" | "live" | "ending" | "ended" | "error";

function LiveStudio() {
  const { liveId } = Route.useParams();
  const getIngest = useServerFn(adminGetLiveIngest);
  const setBroadcastState = useServerFn(adminSetLiveBroadcastState);
  const createReplayUpload = useServerFn(adminCreateReplayUpload);
  const attachReplayRecording = useServerFn(adminAttachReplayRecording);

  const [whipUrl, setWhipUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploadingReplay, setUploadingReplay] = useState(false);
  const [replayUploadProgress, setReplayUploadProgress] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pipRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingCanvasTrackRef = useRef<MediaStreamTrack | null>(null);
  const recordingAnimationRef = useRef<number | null>(null);
  const recordingTickTimerRef = useRef<number | null>(null);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const recordingAudioNodeRef = useRef<ScriptProcessorNode | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const sharingRef = useRef(false);
  const cameraSourceVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenSourceVideoRef = useRef<HTMLVideoElement | null>(null);
  const liveCompositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveCompositeTrackRef = useRef<MediaStreamTrack | null>(null);
  const liveCompositeAnimationRef = useRef<number | null>(null);
  const liveCompositeIntervalRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (!sharing) return;
    attachCameraPip();
    const id = window.setTimeout(() => attachCameraPip(), 120);
    return () => window.clearTimeout(id);
  }, [sharing]);

  useEffect(() => {
    const refreshMedia = () => {
      if (document.visibilityState !== "visible") return;
      if (videoRef.current?.srcObject) void videoRef.current.play().catch(() => {});
      attachCameraPip();
      ensureCameraSource();
      if (screenStreamRef.current) ensureScreenSource(screenStreamRef.current);
      drawLiveCompositeFrame();
      drawRecordingFrame();
    };
    document.addEventListener("visibilitychange", refreshMedia);
    window.addEventListener("focus", refreshMedia);
    return () => {
      document.removeEventListener("visibilitychange", refreshMedia);
      window.removeEventListener("focus", refreshMedia);
    };
  }, []);

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
      ensureCameraSource(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => {});
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
        if (track.kind === "video") {
          try {
            (track as MediaStreamTrack & { contentHint?: string }).contentHint = "motion";
          } catch {}
        }
        const tx = pc.addTransceiver(track, { direction: "sendonly", streams: [streamRef.current] });
        if (track.kind === "video") {
          videoSenderRef.current = tx.sender;
          // Ask the encoder to keep framerate over resolution when the tab is
          // backgrounded — prevents the viewer from seeing a frozen frame.
          try {
            const params = tx.sender.getParameters();
            params.degradationPreference = "maintain-framerate";
            void tx.sender.setParameters(params).catch(() => {});
          } catch {}
        }
      }

      if (sharingRef.current && videoSenderRef.current) {
        const compositeTrack = ensureLiveCompositeTrack();
        if (compositeTrack) await videoSenderRef.current.replaceTrack(compositeTrack).catch(() => {});
      }

      // Try to keep the screen awake so mobile browsers don't suspend capture.
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
        };
        wakeLockRef.current = (await nav.wakeLock?.request("screen")) ?? null;
      } catch {}

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
      startLocalReplayRecording();
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

  async function toggleScreenShare() {
    if (sharing) {
      await stopScreenShare();
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: false,
      });
      screenStreamRef.current = display;
      ensureScreenSource(display);
      ensureCameraSource();
      const screenTrack = display.getVideoTracks()[0];
      if (!screenTrack) throw new Error("Sem faixa de vídeo do ecrã.");
      // Hint the encoder to keep framerate over resolution.
      try {
        (screenTrack as MediaStreamTrack & { contentHint?: string }).contentHint = "detail";
      } catch {}

      // Replace outgoing track (if already live) with a composed canvas track:
      // screen full-frame + camera PiP. Sending the raw screen track makes the
      // camera disappear for viewers and is more likely to look frozen when the
      // browser deprioritises the tab.
      if (videoSenderRef.current) {
        const compositeTrack = ensureLiveCompositeTrack();
        await videoSenderRef.current.replaceTrack(compositeTrack ?? screenTrack);
      }

      // Main preview shows the screen.
      if (videoRef.current) {
        videoRef.current.srcObject = display;
        try { await videoRef.current.play(); } catch {}
      }

      // Auto-stop when user clicks "Stop sharing" in the browser bar.
      screenTrack.addEventListener("ended", () => {
        void stopScreenShare();
      });

      sharingRef.current = true;
      setSharing(true);
      drawLiveCompositeFrame();
      window.setTimeout(() => attachCameraPip(), 0);
    } catch (e) {
      const err = e as DOMException;
      if (err.name !== "NotAllowedError") {
        setError((e as Error).message);
      }
    }
  }

  async function stopScreenShare() {
    const camTrack = streamRef.current?.getVideoTracks()[0];
    if (videoSenderRef.current && camTrack) {
      await videoSenderRef.current.replaceTrack(camTrack).catch(() => {});
    }
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    clearSourceVideo(screenSourceVideoRef);
    stopLiveCompositeTrack();
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      try { await videoRef.current.play(); } catch {}
    }
    if (pipRef.current) pipRef.current.srcObject = null;
    sharingRef.current = false;
    setSharing(false);
  }

  function teardown() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    stopCanvasRecordingLoop();
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    videoSenderRef.current = null;
    stopLiveCompositeTrack();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    clearSourceVideo(cameraSourceVideoRef);
    clearSourceVideo(screenSourceVideoRef);
    sharingRef.current = false;
    setSharing(false);
    startedAtRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (pipRef.current) pipRef.current.srcObject = null;
  }

  async function endLive() {
    setStatus("ending");
    const replayBlob = await stopLocalReplayRecording();
    teardown();
    setElapsed(0);
    await setBroadcastState({ data: { id: liveId, status: "ended" } }).catch((err) => {
      console.error("[live-studio] failed to mark ended", err);
    });
    if (replayBlob && replayBlob.size > 1024 * 1024) {
      await uploadReplayBlob(replayBlob).catch((err) => {
        console.error("[live-studio] replay upload failed", err);
        setError(
          "A live terminou, mas a gravação local não conseguiu ser enviada. Tenta manter a janela aberta e usa RTMP/OBS para máxima garantia.",
        );
      });
    } else {
      setError("A live terminou, mas o navegador não conseguiu gerar um ficheiro de gravação válido.");
    }
    setStatus("ended");
  }

  function startLocalReplayRecording() {
    if (!streamRef.current || !videoRef.current || recorderRef.current) return;
    ensureCameraSource();
    if (screenStreamRef.current) ensureScreenSource(screenStreamRef.current);
    const supportedTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    const mimeType = supportedTypes.find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) {
      console.warn("[live-studio] MediaRecorder WebM não suportado neste navegador");
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      recordingCanvasRef.current = canvas;
      const canvasStream = canvas.captureStream(0);
      recordingCanvasTrackRef.current = canvasStream.getVideoTracks()[0] ?? null;
      const audioContext = new AudioContext();
      recordingAudioContextRef.current = audioContext;
      const audioDestination = audioContext.createMediaStreamDestination();
      const audioTracks = streamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const audioSource = audioContext.createMediaStreamSource(new MediaStream(audioTracks));
        audioSource.connect(audioDestination);
      }

      const mixedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks(),
      ]);

      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(mixedStream, { mimeType, videoBitsPerSecond: 4_500_000 });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorderRef.current = recorder;
      startRecordingTick(audioContext);
      recorder.start(5000);
    } catch (err) {
      console.error("[live-studio] failed to start local recording", err);
    }
  }

  // Drive canvas redraws from two independent clocks so the local recording
  // keeps producing frames even when the tab is backgrounded (where rAF is
  // throttled to ~1fps). The ScriptProcessorNode fires on the audio thread and
  // isn't subject to hidden-tab throttling.
  function startRecordingTick(audioContext: AudioContext) {
    let lastTick = 0;
    const targetInterval = 1000 / 30;

    const tick = () => {
      const now = performance.now();
      if (now - lastTick >= targetInterval) {
        lastTick = now;
        if (liveCompositeTrackRef.current) drawLiveCompositeFrame();
        drawRecordingFrame();
      }
    };

    const rafLoop = () => {
      tick();
      recordingAnimationRef.current = requestAnimationFrame(rafLoop);
    };
    recordingAnimationRef.current = requestAnimationFrame(rafLoop);

    try {
      const node = audioContext.createScriptProcessor(2048, 1, 1);
      node.onaudioprocess = () => tick();
      const silent = audioContext.createConstantSource();
      silent.offset.value = 0;
      silent.connect(node);
      node.connect(audioContext.destination);
      silent.start();
      recordingAudioNodeRef.current = node;
    } catch (err) {
      console.warn("[live-studio] audio timer unavailable, relying on rAF only", err);
    }
  }

  function drawRecordingFrame() {
    const canvas = recordingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const mainVideo = sharingRef.current
      ? screenSourceVideoRef.current ?? videoRef.current
      : cameraSourceVideoRef.current ?? videoRef.current;
    if (mainVideo && mainVideo.videoWidth > 0 && mainVideo.videoHeight > 0) {
      drawCover(ctx, mainVideo, 0, 0, canvas.width, canvas.height);
    }
    const cameraVideo = cameraSourceVideoRef.current ?? pipRef.current;
    if (sharingRef.current && cameraVideo && cameraVideo.videoWidth > 0 && cameraVideo.videoHeight > 0) {
      const w = 300;
      const h = 170;
      const x = canvas.width - w - 32;
      const y = canvas.height - h - 32;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      roundRect(ctx, x - 6, y - 6, w + 12, h + 12, 18);
      ctx.fill();
      drawCover(ctx, cameraVideo, x, y, w, h);
    }

    const requestableTrack = recordingCanvasTrackRef.current as (MediaStreamTrack & { requestFrame?: () => void }) | null;
    requestableTrack?.requestFrame?.();
  }

  function ensureLiveCompositeTrack() {
    if (liveCompositeTrackRef.current) return liveCompositeTrackRef.current;
    if (!screenStreamRef.current) return null;

    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    if (typeof canvas.captureStream !== "function") return null;

    liveCompositeCanvasRef.current = canvas;
    const compositeStream = canvas.captureStream(0);
    const track = compositeStream.getVideoTracks()[0];
    if (!track) {
      liveCompositeCanvasRef.current = null;
      return null;
    }
    try {
      (track as MediaStreamTrack & { contentHint?: string }).contentHint = "detail";
    } catch {}
    liveCompositeTrackRef.current = track;
    startLiveCompositeLoop();
    drawLiveCompositeFrame();
    return track;
  }

  function startLiveCompositeLoop() {
    if (liveCompositeAnimationRef.current !== null || liveCompositeIntervalRef.current !== null) return;
    const tick = () => drawLiveCompositeFrame();
    const rafLoop = () => {
      tick();
      liveCompositeAnimationRef.current = requestAnimationFrame(rafLoop);
    };
    liveCompositeAnimationRef.current = requestAnimationFrame(rafLoop);
    liveCompositeIntervalRef.current = window.setInterval(tick, 1000 / 15);
  }

  function drawLiveCompositeFrame() {
    const canvas = liveCompositeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const screenVideo = screenSourceVideoRef.current ?? videoRef.current;
    if (screenVideo && screenVideo.videoWidth > 0 && screenVideo.videoHeight > 0) {
      drawCover(ctx, screenVideo, 0, 0, canvas.width, canvas.height);
    }

    const cameraVideo = cameraSourceVideoRef.current ?? pipRef.current;
    if (cameraVideo && cameraVideo.videoWidth > 0 && cameraVideo.videoHeight > 0) {
      const w = 300;
      const h = 170;
      const x = canvas.width - w - 32;
      const y = canvas.height - h - 32;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      roundRect(ctx, x - 6, y - 6, w + 12, h + 12, 18);
      ctx.fill();
      drawCover(ctx, cameraVideo, x, y, w, h);
    }

    const requestableTrack = liveCompositeTrackRef.current as (MediaStreamTrack & { requestFrame?: () => void }) | null;
    requestableTrack?.requestFrame?.();
  }

  function stopLiveCompositeTrack() {
    if (liveCompositeAnimationRef.current !== null) {
      cancelAnimationFrame(liveCompositeAnimationRef.current);
      liveCompositeAnimationRef.current = null;
    }
    if (liveCompositeIntervalRef.current !== null) {
      clearInterval(liveCompositeIntervalRef.current);
      liveCompositeIntervalRef.current = null;
    }
    liveCompositeTrackRef.current?.stop();
    liveCompositeTrackRef.current = null;
    liveCompositeCanvasRef.current = null;
  }

  function ensureCameraSource(stream = streamRef.current) {
    if (!stream) return null;
    if (cameraSourceVideoRef.current?.srcObject !== stream) {
      clearSourceVideo(cameraSourceVideoRef);
      cameraSourceVideoRef.current = createMutedVideo(stream);
    }
    return cameraSourceVideoRef.current;
  }

  function ensureScreenSource(stream: MediaStream) {
    if (screenSourceVideoRef.current?.srcObject !== stream) {
      clearSourceVideo(screenSourceVideoRef);
      screenSourceVideoRef.current = createMutedVideo(stream);
    }
    return screenSourceVideoRef.current;
  }

  function createMutedVideo(stream: MediaStream) {
    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    void video.play().catch(() => {});
    return video;
  }

  function attachCameraPip() {
    const stream = streamRef.current;
    const pip = pipRef.current;
    if (!stream || !pip) return;
    if (pip.srcObject !== stream) pip.srcObject = stream;
    pip.muted = true;
    pip.playsInline = true;
    ensureCameraSource(stream);
    void pip.play().catch(() => {});
  }

  function clearSourceVideo(ref: { current: HTMLVideoElement | null }) {
    const video = ref.current;
    if (!video) return;
    video.pause();
    video.srcObject = null;
    ref.current = null;
  }

  function stopCanvasRecordingLoop() {
    if (recordingAnimationRef.current !== null) {
      cancelAnimationFrame(recordingAnimationRef.current);
      recordingAnimationRef.current = null;
    }
    if (recordingTickTimerRef.current !== null) {
      clearInterval(recordingTickTimerRef.current);
      recordingTickTimerRef.current = null;
    }
    try {
      recordingAudioNodeRef.current?.disconnect();
    } catch {}
    recordingAudioNodeRef.current = null;
    void recordingAudioContextRef.current?.close().catch(() => {});
    recordingAudioContextRef.current = null;
    recordingCanvasTrackRef.current?.stop();
    recordingCanvasTrackRef.current = null;
    recordingCanvasRef.current = null;
    void wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }


  async function stopLocalReplayRecording(): Promise<Blob | null> {
    const recorder = recorderRef.current;
    if (!recorder) return null;
    return await new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        stopCanvasRecordingLoop();
        recorderRef.current = null;
        resolve(new Blob(recordedChunksRef.current, { type: recorder.mimeType || "video/webm" }));
      }, 6000);
      recorder.onstop = () => {
        window.clearTimeout(timeout);
        stopCanvasRecordingLoop();
        recorderRef.current = null;
        resolve(new Blob(recordedChunksRef.current, { type: recorder.mimeType || "video/webm" }));
      };
      if (recorder.state !== "inactive") recorder.stop();
    });
  }

  async function uploadReplayBlob(blob: Blob) {
    setUploadingReplay(true);
    setReplayUploadProgress(0);
    try {
      const upload = await createReplayUpload({ data: { id: liveId, sizeBytes: blob.size } });
      await uploadWithProgress(upload.uploadURL, blob, (progress) => setReplayUploadProgress(progress));
      await attachReplayRecording({ data: { id: liveId, videoUid: upload.uid } });
      setReplayUploadProgress(100);
    } finally {
      setUploadingReplay(false);
    }
  }

  function uploadWithProgress(url: string, blob: Blob, onProgress: (progress: number) => void) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append("file", blob, `mm-live-${liveId}.webm`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload HTTP ${xhr.status}: ${xhr.responseText || xhr.statusText}`));
      };
      xhr.onerror = () => reject(new Error("Falha de rede ao enviar a gravação."));
      xhr.open("POST", url);
      xhr.send(form);
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

                {(status === "live" || status === "connecting" || status === "ending") && (
                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-500/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                    {status === "live" ? `AO VIVO · ${mmss}` : status === "ending" ? "A guardar replay…" : "A ligar…"}
                </div>
              )}

              {sharing && (
                <div className="absolute bottom-4 right-4 z-10 h-32 w-48 overflow-hidden rounded-xl border border-white/20 bg-black shadow-2xl ring-1 ring-black/40 sm:h-40 sm:w-60">
                  <video
                    ref={pipRef}
                    autoPlay
                    muted
                    playsInline
                    onLoadedMetadata={() => pipRef.current?.play().catch(() => {})}
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-white">
                    Câmara
                  </div>
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
                <button
                  type="button"
                  onClick={toggleScreenShare}
                  disabled={!streamRef.current}
                  className={
                    "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium transition disabled:opacity-40 " +
                    (sharing
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border hover:border-primary/40")
                  }
                  title={sharing ? "Parar partilha de ecrã" : "Partilhar ecrã"}
                >
                  {sharing ? <MonitorOff className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
                  <span className="hidden sm:inline">
                    {sharing ? "Parar partilha" : "Partilhar ecrã"}
                  </span>
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
                {status === "ending" && (
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {uploadingReplay
                      ? `A enviar replay${replayUploadProgress !== null ? ` · ${replayUploadProgress}%` : ""}`
                      : "A finalizar gravação…"}
                  </span>
                )}
                {status === "ended" && (
                  <span className="text-xs text-muted-foreground">
                    Transmissão terminada. O replay fica disponível assim que o processamento concluir.
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
              <li>Ao terminar, o navegador envia uma cópia local da transmissão para garantir o replay.</li>
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

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource & { videoWidth?: number; videoHeight?: number },
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const sourceWidth = source.videoWidth || width;
  const sourceHeight = source.videoHeight || height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(source, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
