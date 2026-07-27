/**
 * <PreJoin> — "green room" shown before actually entering the live room.
 *
 * Pure client-side preview (getUserMedia): the host can check framing,
 * pick camera/microphone, see the audio level and decide whether to enter
 * with camera/mic on — all before any track is published to the room.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { readMediaPrefs, writeMediaPrefs, type MediaPrefs } from "@/lib/media-prefs";

interface Props {
  /** Label of the room the user is about to enter. */
  title?: string;
  subtitle?: string;
  entering?: boolean;
  onEnter: (prefs: MediaPrefs) => void;
  onCancel?: () => void;
}

type DeviceOpt = { deviceId: string; label: string };

export function PreJoin({ title = "Pronto para entrar?", subtitle, entering, onEnter, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [prefs, setPrefs] = useState<MediaPrefs>(() => readMediaPrefs());
  const [cameras, setCameras] = useState<DeviceOpt[]>([]);
  const [mics, setMics] = useState<DeviceOpt[]>([]);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const stopStream = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setCameras(
        list
          .filter((d) => d.kind === "videoinput" && d.deviceId)
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Câmara ${i + 1}` })),
      );
      setMics(
        list
          .filter((d) => d.kind === "audioinput" && d.deviceId)
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microfone ${i + 1}` })),
      );
    } catch {
      /* ignore */
    }
  }, []);

  // (Re)open the preview stream whenever the selection changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      stopStream();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: prefs.camEnabled ? (prefs.cameraId ? { deviceId: { exact: prefs.cameraId } } : true) : false,
          audio: prefs.micId ? { deviceId: { exact: prefs.micId } } : true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setError(null);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        await refreshDevices();

        // Audio level meter.
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const ctx = new Ctx();
          audioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
          const buf = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            analyser.getByteTimeDomainData(buf);
            let peak = 0;
            for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128));
            setLevel(Math.min(1, (peak / 128) * 2.2));
            rafRef.current = requestAnimationFrame(tick);
          };
          tick();
        }
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error && /NotAllowedError|Permission/i.test(e.message)
            ? "Permite o acesso à câmara e microfone no browser para pré-visualizar."
            : "Não foi possível aceder aos dispositivos.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.cameraId, prefs.micId, prefs.camEnabled]);

  useEffect(() => stopStream, [stopStream]);

  const update = (patch: Partial<MediaPrefs>) => setPrefs((p) => ({ ...p, ...patch }));

  const enter = () => {
    writeMediaPrefs(prefs);
    stopStream();
    onEnter(prefs);
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-black p-4 text-white">
      <div className="grid w-full max-w-4xl gap-5 md:grid-cols-[1.4fr_1fr] md:items-center">
        {/* Preview */}
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-neutral-950 ring-1 ring-white/10">
          {prefs.camEnabled ? (
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full scale-x-[-1] object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-white/50">
              Câmara desligada
            </div>
          )}
          {loading && prefs.camEnabled && (
            <div className="absolute inset-0 grid place-items-center bg-black/50">
              <Loader2 className="h-5 w-5 animate-spin text-white/70" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-3">
            <button
              type="button"
              onClick={() => update({ micEnabled: !prefs.micEnabled })}
              aria-label={prefs.micEnabled ? "Entrar com microfone desligado" : "Entrar com microfone ligado"}
              className={cn(
                "grid h-10 w-10 place-items-center rounded-full transition",
                prefs.micEnabled ? "bg-white/10 hover:bg-white/20" : "bg-red-500/90 hover:bg-red-500",
              )}
            >
              {prefs.micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => update({ camEnabled: !prefs.camEnabled })}
              aria-label={prefs.camEnabled ? "Entrar com câmara desligada" : "Entrar com câmara ligada"}
              className={cn(
                "grid h-10 w-10 place-items-center rounded-full transition",
                prefs.camEnabled ? "bg-white/10 hover:bg-white/20" : "bg-red-500/90 hover:bg-red-500",
              )}
            >
              {prefs.camEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-4">
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-white/60">{subtitle}</p>}
          </div>

          {error && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {error}
            </div>
          )}

          <label className="block space-y-1.5">
            <span className="text-[11px] uppercase tracking-wide text-white/40">Câmara</span>
            <select
              value={prefs.cameraId ?? cameras[0]?.deviceId ?? ""}
              onChange={(e) => update({ cameraId: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
            >
              {cameras.length === 0 && <option value="">Sem câmaras detetadas</option>}
              {cameras.map((c) => (
                <option key={c.deviceId} value={c.deviceId} className="bg-neutral-900">
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-[11px] uppercase tracking-wide text-white/40">Microfone</span>
            <select
              value={prefs.micId ?? mics[0]?.deviceId ?? ""}
              onChange={(e) => update({ micId: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
            >
              {mics.length === 0 && <option value="">Sem microfones detetados</option>}
              {mics.map((m) => (
                <option key={m.deviceId} value={m.deviceId} className="bg-neutral-900">
                  {m.label}
                </option>
              ))}
            </select>
            <span className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <span
                className="h-full rounded-full bg-emerald-400 transition-[width] duration-75"
                style={{ width: `${Math.round(level * 100)}%` }}
              />
            </span>
          </label>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={enter}
              disabled={entering}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-60"
            >
              {entering && <Loader2 className="h-4 w-4 animate-spin" />}
              Entrar na sala
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={() => {
                  stopStream();
                  onCancel();
                }}
                className="rounded-full border border-white/15 px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/5"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
