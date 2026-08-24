/**
 * Efeito sonoro de suspense para o popup da ofensiva.
 * Sintetizado com WebAudio (sem ficheiros): um drone que sobe,
 * um "whoosh" e um impacto final com brilho dourado.
 */
export function playStreakSound() {
  if (typeof window === "undefined") return;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;

  let ctx: AudioContext;
  try {
    ctx = new Ctx();
  } catch {
    return;
  }
  void ctx.resume?.();

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);

  // 1) Drone de suspense (sobe durante ~1.4s)
  const drone = ctx.createOscillator();
  drone.type = "sawtooth";
  drone.frequency.setValueAtTime(70, now);
  drone.frequency.exponentialRampToValueAtTime(230, now + 1.4);
  const droneFilter = ctx.createBiquadFilter();
  droneFilter.type = "lowpass";
  droneFilter.frequency.setValueAtTime(240, now);
  droneFilter.frequency.exponentialRampToValueAtTime(2200, now + 1.4);
  const droneGain = ctx.createGain();
  droneGain.gain.setValueAtTime(0.0001, now);
  droneGain.gain.exponentialRampToValueAtTime(0.5, now + 1.3);
  droneGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.75);
  drone.connect(droneFilter).connect(droneGain).connect(master);
  drone.start(now);
  drone.stop(now + 1.8);

  // 2) Whoosh (ruído filtrado) mesmo antes do impacto
  const noiseLen = Math.floor(ctx.sampleRate * 0.9);
  const buffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < noiseLen; i += 1) data[i] = (Math.random() * 2 - 1) * 0.6;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.Q.value = 0.8;
  noiseFilter.frequency.setValueAtTime(400, now + 0.55);
  noiseFilter.frequency.exponentialRampToValueAtTime(4500, now + 1.4);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now + 0.55);
  noiseGain.gain.exponentialRampToValueAtTime(0.28, now + 1.35);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.7);
  noise.connect(noiseFilter).connect(noiseGain).connect(master);
  noise.start(now + 0.55);
  noise.stop(now + 1.7);

  // 3) Impacto + acorde dourado no clímax
  const hit = now + 1.42;
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(120, hit);
  sub.frequency.exponentialRampToValueAtTime(42, hit + 0.6);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.9, hit);
  subGain.gain.exponentialRampToValueAtTime(0.0001, hit + 0.9);
  sub.connect(subGain).connect(master);
  sub.start(hit);
  sub.stop(hit + 1);

  [523.25, 659.25, 987.77].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const t = hit + i * 0.06;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + 1.7);
  });

  window.setTimeout(() => void ctx.close?.(), 3600);
}
