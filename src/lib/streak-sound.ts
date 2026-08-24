/**
 * Efeito sonoro cinematográfico para o popup da ofensiva.
 *
 * Estrutura tipo trailer de cinema: um riser suave de ruído filtrado,
 * um sub "braam" grave e quente no impacto, e um acorde maior com cauda
 * de reverberação (convolver com impulso sintetizado) que fecha o momento.
 * Tudo sintetizado com WebAudio — sem ficheiros externos.
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
  const sr = ctx.sampleRate;

  // --- Barramento principal + reverberação de sala grande ---
  const master = ctx.createGain();
  master.gain.value = 0.42;
  master.connect(ctx.destination);

  // Impulso sintetizado: cauda ~2.6s com decaimento exponencial (hall).
  const irLen = Math.floor(sr * 2.6);
  const ir = ctx.createBuffer(2, irLen, sr);
  for (let c = 0; c < 2; c += 1) {
    const ch = ir.getChannelData(c);
    for (let i = 0; i < irLen; i += 1) {
      ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.6);
    }
  }
  const reverb = ctx.createConvolver();
  reverb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  reverb.connect(wet).connect(master);

  /** Envia um nó para o barramento seco e para a reverberação. */
  const send = (node: AudioNode) => {
    node.connect(master);
    node.connect(reverb);
  };

  const hit = now + 2.0;

  // --- 1) Riser: ruído rosa filtrado a abrir lentamente ---
  const noiseLen = Math.floor(sr * 2.2);
  const nbuf = ctx.createBuffer(1, noiseLen, sr);
  const nd = nbuf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < noiseLen; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02; // suaviza -> ruído rosa-ish
    nd[i] = last * 3.2;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = nbuf;
  const nFilter = ctx.createBiquadFilter();
  nFilter.type = "bandpass";
  nFilter.Q.value = 0.7;
  nFilter.frequency.setValueAtTime(220, now);
  nFilter.frequency.exponentialRampToValueAtTime(5200, hit);
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.0001, now);
  nGain.gain.exponentialRampToValueAtTime(0.22, hit - 0.05);
  nGain.gain.exponentialRampToValueAtTime(0.0001, hit + 0.35);
  noise.connect(nFilter).connect(nGain);
  send(nGain);
  noise.start(now);
  noise.stop(hit + 0.4);

  // --- 2) Pad grave a crescer (tensão contida, sem zumbido) ---
  [55, 82.41].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.detune.value = i === 0 ? -4 : 5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.16, hit - 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, hit + 0.5);
    osc.connect(g);
    send(g);
    osc.start(now);
    osc.stop(hit + 0.6);
  });

  // --- 3) Impacto: sub "braam" quente ---
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(90, hit);
  sub.frequency.exponentialRampToValueAtTime(34, hit + 1.2);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.0001, hit);
  subGain.gain.linearRampToValueAtTime(0.85, hit + 0.04);
  subGain.gain.exponentialRampToValueAtTime(0.0001, hit + 1.6);
  sub.connect(subGain);
  send(subGain);
  sub.start(hit);
  sub.stop(hit + 1.7);

  // --- 4) Acorde maior (Fá) com brilho suave e cauda longa ---
  [174.61, 261.63, 349.23, 523.25].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = i > 1 ? "triangle" : "sine";
    osc.frequency.value = freq;
    osc.detune.value = (i % 2 === 0 ? -3 : 3);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1200, hit);
    lp.frequency.exponentialRampToValueAtTime(4200, hit + 0.5);
    const g = ctx.createGain();
    const t = hit + i * 0.02;
    const peak = 0.2 - i * 0.03;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    osc.connect(lp).connect(g);
    send(g);
    osc.start(t);
    osc.stop(t + 2.8);
  });

  window.setTimeout(() => void ctx.close?.(), 6000);
}
