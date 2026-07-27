/**
 * Processadores de media para o MM Studio Live.
 *
 * - StudioVideoProcessor: canvas em tempo real (iluminação, contraste, cor,
 *   suavização de pele e vinheta) aplicado ao track da câmara antes de publicar.
 * - StudioAudioProcessor: cadeia WebAudio (high-pass, gate de ruído adaptativo,
 *   presença e compressor) aplicada ao microfone.
 *
 * Ambos implementam a interface TrackProcessor do livekit-client, pelo que são
 * ligados via localTrack.setProcessor(...).
 */
import type { Track } from "livekit-client";
import { getStudioSettings, studioCssFilter, subscribeStudio, type StudioSettings } from "./studio-filters";

type ProcessorOpts = { track: MediaStreamTrack; audioContext?: AudioContext };

/* ------------------------------------------------------------------ vídeo */

export class StudioVideoProcessor {
  name = "mm-studio-video";
  processedTrack?: MediaStreamTrack;

  private video?: HTMLVideoElement;
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D | null;
  private raf = 0;
  private stopped = false;
  private settings: StudioSettings = getStudioSettings();
  private unsub?: () => void;

  async init(opts: ProcessorOpts) {
    const stream = new MediaStream([opts.track]);
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play().catch(() => {});
    this.video = video;

    const settings = opts.track.getSettings();
    const canvas = document.createElement("canvas");
    canvas.width = settings.width ?? 1280;
    canvas.height = settings.height ?? 720;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });

    this.unsub = subscribeStudio((s) => {
      this.settings = s;
    });

    const fps = settings.frameRate ?? 30;
    this.processedTrack = canvas.captureStream(fps).getVideoTracks()[0];
    this.loop();
  }

  private loop = () => {
    if (this.stopped) return;
    const { video, canvas, ctx } = this;
    if (video && canvas && ctx && video.videoWidth) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const s = this.settings;
      ctx.save();
      ctx.filter = studioCssFilter(s);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Suavização de pele: camada desfocada em modo "lighten" com opacidade baixa.
      if (s.videoEnabled && s.softness > 0) {
        ctx.save();
        ctx.globalAlpha = 0.35 * s.softness;
        ctx.globalCompositeOperation = "lighten";
        ctx.filter = `${studioCssFilter(s)} blur(${(6 * s.softness).toFixed(1)}px)`;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      // Vinheta cinematográfica.
      if (s.videoEnabled && s.vignette > 0) {
        const g = ctx.createRadialGradient(
          canvas.width / 2,
          canvas.height / 2,
          Math.min(canvas.width, canvas.height) * 0.35,
          canvas.width / 2,
          canvas.height / 2,
          Math.max(canvas.width, canvas.height) * 0.72,
        );
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, `rgba(0,0,0,${(0.75 * s.vignette).toFixed(2)})`);
        ctx.save();
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  async restart(opts: ProcessorOpts) {
    await this.destroy();
    this.stopped = false;
    await this.init(opts);
  }

  async destroy() {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    this.unsub?.();
    this.processedTrack?.stop();
    this.processedTrack = undefined;
    if (this.video) {
      this.video.srcObject = null;
      this.video = undefined;
    }
  }
}

/* ------------------------------------------------------------------ áudio */

export class StudioAudioProcessor {
  name = "mm-studio-audio";
  processedTrack?: MediaStreamTrack;

  private ctxAudio?: AudioContext;
  private ownsContext = false;
  private source?: MediaStreamAudioSourceNode;
  private highpass?: BiquadFilterNode;
  private presence?: BiquadFilterNode;
  private deEsser?: BiquadFilterNode;
  private gate?: GainNode;
  private compressor?: DynamicsCompressorNode;
  private makeup?: GainNode;
  private analyser?: AnalyserNode;
  private dest?: MediaStreamAudioDestinationNode;
  private raf = 0;
  private stopped = false;
  private settings: StudioSettings = getStudioSettings();
  private unsub?: () => void;
  private buf?: Float32Array;
  private gateLevel = 1;

  async init(opts: ProcessorOpts) {
    const AC: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = opts.audioContext ?? new AC();
    this.ownsContext = !opts.audioContext;
    this.ctxAudio = ctx;
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});

    this.source = ctx.createMediaStreamSource(new MediaStream([opts.track]));

    this.highpass = ctx.createBiquadFilter();
    this.highpass.type = "highpass";

    this.deEsser = ctx.createBiquadFilter();
    this.deEsser.type = "peaking";
    this.deEsser.frequency.value = 7000;
    this.deEsser.Q.value = 1.4;

    this.presence = ctx.createBiquadFilter();
    this.presence.type = "peaking";
    this.presence.frequency.value = 3000;
    this.presence.Q.value = 0.9;

    this.gate = ctx.createGain();
    this.compressor = ctx.createDynamicsCompressor();
    this.makeup = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.buf = new Float32Array(this.analyser.fftSize);
    this.dest = ctx.createMediaStreamDestination();

    this.source
      .connect(this.highpass)
      .connect(this.deEsser)
      .connect(this.presence)
      .connect(this.gate)
      .connect(this.compressor)
      .connect(this.makeup)
      .connect(this.dest);
    this.presence.connect(this.analyser);

    this.applySettings(this.settings);
    this.unsub = subscribeStudio((s) => {
      this.settings = s;
      this.applySettings(s);
    });

    this.processedTrack = this.dest.stream.getAudioTracks()[0];
    this.tick();
  }

  private applySettings(s: StudioSettings) {
    const on = s.audioEnabled;
    if (this.highpass) this.highpass.frequency.value = on ? 60 + s.voiceClarity * 90 : 20;
    if (this.presence) this.presence.gain.value = on ? s.voiceClarity * 5 : 0;
    if (this.deEsser) this.deEsser.gain.value = on ? -s.voiceClarity * 4 : 0;
    if (this.compressor) {
      this.compressor.threshold.value = on ? -34 + (1 - s.voiceLeveling) * 20 : 0;
      this.compressor.ratio.value = on ? 2 + s.voiceLeveling * 8 : 1;
      this.compressor.knee.value = 24;
      this.compressor.attack.value = 0.006;
      this.compressor.release.value = 0.18;
    }
    if (this.makeup) this.makeup.gain.value = on ? 1 + s.voiceLeveling * 0.6 : 1;
  }

  /** Gate adaptativo: mede o RMS e fecha suavemente abaixo do limiar de ruído. */
  private tick = () => {
    if (this.stopped) return;
    const s = this.settings;
    if (this.analyser && this.buf && this.gate && this.ctxAudio) {
      if (!s.audioEnabled || s.noiseReduction <= 0) {
        this.gateLevel = 1;
      } else {
        this.analyser.getFloatTimeDomainData(this.buf as Float32Array<ArrayBuffer>);
        let sum = 0;
        for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
        const rms = Math.sqrt(sum / this.buf.length);
        const threshold = 0.004 + s.noiseReduction * 0.035;
        const target = rms > threshold ? 1 : Math.max(0, 1 - s.noiseReduction);
        // Ataque rápido, libertação lenta para não cortar finais de palavra.
        const k = target > this.gateLevel ? 0.55 : 0.06;
        this.gateLevel += (target - this.gateLevel) * k;
      }
      this.gate.gain.setTargetAtTime(this.gateLevel, this.ctxAudio.currentTime, 0.02);
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  async restart(opts: ProcessorOpts) {
    await this.destroy();
    this.stopped = false;
    await this.init(opts);
  }

  async destroy() {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    this.unsub?.();
    try {
      this.source?.disconnect();
      this.gate?.disconnect();
      this.compressor?.disconnect();
      this.makeup?.disconnect();
    } catch {
      /* ignore */
    }
    this.processedTrack = undefined;
    if (this.ownsContext) await this.ctxAudio?.close().catch(() => {});
    this.ctxAudio = undefined;
  }
}

/* -------------------------------------------------- ligação à sala LiveKit */

type LocalTrackLike = {
  kind: string;
  source?: unknown;
  setProcessor?: (p: unknown) => Promise<void>;
  stopProcessor?: () => Promise<void>;
  getProcessor?: () => unknown;
};

type RoomLike = {
  localParticipant?: {
    videoTrackPublications?: Map<string, { track?: LocalTrackLike; source?: unknown }>;
    audioTrackPublications?: Map<string, { track?: LocalTrackLike; source?: unknown }>;
  };
};

const CAMERA: Track.Source | string = "camera";
const MIC: Track.Source | string = "microphone";

/**
 * Aplica (ou remove) os processadores de estúdio aos tracks locais da sala.
 * Seguro para chamar várias vezes — só liga/desliga quando o estado muda.
 */
export async function syncStudioProcessors(room: unknown) {
  const r = room as RoomLike | null | undefined;
  const lp = r?.localParticipant;
  if (!lp) return;
  const s = getStudioSettings();

  const apply = async (
    pubs: Map<string, { track?: LocalTrackLike; source?: unknown }> | undefined,
    wantedSource: unknown,
    enabled: boolean,
    make: () => unknown,
  ) => {
    if (!pubs) return;
    for (const pub of pubs.values()) {
      if (String(pub.source ?? "") !== String(wantedSource)) continue;
      const track = pub.track;
      if (!track?.setProcessor) continue;
      const has = Boolean(track.getProcessor?.());
      try {
        if (enabled && !has) await track.setProcessor(make());
        else if (!enabled && has) await track.stopProcessor?.();
      } catch (err) {
        console.warn("[studio] processor sync failed", err);
      }
    }
  };

  await apply(lp.videoTrackPublications, CAMERA, s.videoEnabled, () => new StudioVideoProcessor());
  await apply(lp.audioTrackPublications, MIC, s.audioEnabled, () => new StudioAudioProcessor());
}
