import { useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSaleAmount } from "@/lib/aplicacao/sale-rules";
import { SALE_BELL_STRIKES, SALE_BELL_STRIKE_GAP_MS, SALE_BELL_STRIKE_TIMEOUT_MS } from "@/lib/aplicacao/sale-bell";
import bellAsset from "@/assets/sale-bell.mp3.asset.json";

// Counter Bell #3, Joseph Sardin / BigSoundBank, CC0.
export function useSaleBell() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { audioRef.current?.pause(); }, []);
  function prepare() {
    const audio = audioRef.current ?? new Audio(bellAsset.url);
    audioRef.current = audio;
    audio.preload = "auto";
    audio.load();
  }
  // Simply plays the bell sound from the start, waits for it to end, and repeats — three times.
  async function ring() {
    const audio = audioRef.current;
    if (!audio) return;
    for (let strike = 0; strike < SALE_BELL_STRIKES; strike++) {
      try {
        audio.currentTime = 0;
        await audio.play();
        await waitEnded(audio);
        if (strike < SALE_BELL_STRIKES - 1) await wait(SALE_BELL_STRIKE_GAP_MS);
      } catch { break; }
    }
  }
  return { prepare, ring };
}

function wait(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function waitEnded(audio: HTMLAudioElement) {
  return new Promise<void>(resolve => {
    const done = () => { audio.removeEventListener("ended", done); clearTimeout(timer); resolve(); };
    const timer = setTimeout(done, SALE_BELL_STRIKE_TIMEOUT_MS);
    audio.addEventListener("ended", done);
  });
}

export function SaleCelebration({ amount, closer, onDismiss }: { amount: number; closer?: string; onDismiss: () => void }) {
  useEffect(() => { const timer = setTimeout(onDismiss, 6000); return () => clearTimeout(timer); }, [onDismiss]);
  return <div role="status" aria-live="polite" className="sale-celebration fixed inset-x-4 bottom-6 z-[80] mx-auto flex max-w-md items-center gap-5 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-xl">
    <div className="sale-bell flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Bell className="h-10 w-10" strokeWidth={1.7} /></div>
    <div className="min-w-0 flex-1"><p className="text-sm font-medium text-muted-foreground">Venda realizada</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatSaleAmount(amount)}</p>{closer && <p className="mt-1 truncate text-sm text-muted-foreground">Fechado por: {closer}</p>}</div>
    <Button variant="ghost" size="icon" aria-label="Fechar celebração" onClick={onDismiss}>×</Button>
  </div>;
}