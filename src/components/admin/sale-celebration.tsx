import { useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSaleAmount } from "@/lib/aplicacao/sale-rules";
import { saleBellStrikeEnds, saleBellStrikeTimes } from "@/lib/aplicacao/sale-bell";
import bellAsset from "@/assets/sale-bell.mp3.asset.json";

// Counter Bell #3, Joseph Sardin / BigSoundBank, CC0.
export function useSaleBell() {
  const context = useRef<AudioContext | null>(null);
  const buffer = useRef<Promise<AudioBuffer> | null>(null);
  useEffect(() => () => { void context.current?.close(); }, []);
  function prepare() {
    const audio = context.current ?? new AudioContext();
    context.current = audio;
    void audio.resume().catch(() => undefined);
    buffer.current ??= fetch(bellAsset.url).then(r => {
      if (!r.ok) throw new Error("Bell unavailable");
      return r.arrayBuffer();
    }).then(bytes => audio.decodeAudioData(bytes));
    void buffer.current.catch(() => undefined);
  }
  async function ring() {
    const audio = context.current;
    if (!audio || !buffer.current) return;
    try {
      const hit = await buffer.current;
      const times = saleBellStrikeTimes();
      const ends = saleBellStrikeEnds(times, hit.duration);
      const first = audio.currentTime + 0.02;
      times.forEach((offset, i) => {
        const source = audio.createBufferSource();
        source.buffer = hit;
        // Fade each strike out just before the next one, so the three hits stay distinct.
        const gain = audio.createGain();
        const start = first + offset;
        const end = ends[i];
        const fadeFrom = Math.max(start, end - 0.25);
        gain.gain.setValueAtTime(1, start);
        gain.gain.setValueAtTime(1, fadeFrom);
        gain.gain.linearRampToValueAtTime(0.0001, end);
        source.connect(gain).connect(audio.destination);
        source.start(start);
        source.stop(end);
      });
    } catch { /* The recorded sale remains valid if audio is unavailable. */ }
  }
  return { prepare, ring };
}

export function SaleCelebration({ amount, closer, onDismiss }: { amount: number; closer?: string; onDismiss: () => void }) {
  useEffect(() => { const timer = setTimeout(onDismiss, 5000); return () => clearTimeout(timer); }, [onDismiss]);
  return <div role="status" aria-live="polite" className="sale-celebration fixed inset-x-4 bottom-6 z-[80] mx-auto flex max-w-md items-center gap-5 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-xl">
    <div className="sale-bell flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Bell className="h-10 w-10" strokeWidth={1.7} /></div>
    <div className="min-w-0 flex-1"><p className="text-sm font-medium text-muted-foreground">Venda realizada</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatSaleAmount(amount)}</p>{closer && <p className="mt-1 truncate text-sm text-muted-foreground">Fechado por: {closer}</p>}</div>
    <Button variant="ghost" size="icon" aria-label="Fechar celebração" onClick={onDismiss}>×</Button>
  </div>;
}