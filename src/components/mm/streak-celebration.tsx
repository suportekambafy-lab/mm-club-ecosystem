import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Flame } from "lucide-react";
import { playStreakSound } from "@/lib/streak-sound";

const STORAGE_KEY = "mm:streak-celebrated";

type Stored = { streak: number; day: string };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function read(): Stored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    return typeof parsed?.streak === "number" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Decide se hoje há motivo para festejar a ofensiva (estilo Duolingo):
 * só a partir do 2.º dia seguido e apenas uma vez por dia/valor. Se a
 * sequência recomeçar (a pessoa faltou), o marcador é reposto para a nova
 * contagem voltar a ser celebrada.
 */
export function shouldCelebrateStreak(streak: number): boolean {
  if (streak < 2) {
    // Sequência quebrada/recomeçada: limpa o marcador para celebrar de novo.
    const prev = read();
    if (prev && prev.streak >= 2 && typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    return false;
  }
  const prev = read();
  if (!prev) return true;
  if (streak > prev.streak) return true;
  // Mesma contagem já celebrada hoje (ou antes) → não repetir.
  return false;
}

export function markStreakCelebrated(streak: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ streak, day: today() } satisfies Stored),
    );
  } catch {
    /* ignore */
  }
}

function message(streak: number): string {
  if (streak >= 30) return "Um mês inteiro sem falhar. Isto já é identidade.";
  if (streak >= 14) return "Duas semanas seguidas. Estás no grupo dos que acabam.";
  if (streak >= 7) return "Uma semana inteira. O hábito está criado.";
  if (streak >= 3) return "Três dias seguidos — é aqui que o hábito pega.";
  return "Segundo dia seguido. Continua, é assim que se constrói.";
}

/** Popup animado de parabéns pela ofensiva de dias seguidos. */
export function StreakCelebration({
  open,
  streak,
  onClose,
}: {
  open: boolean;
  streak: number;
  onClose: () => void;
}) {
  const [display, setDisplay] = useState(0);

  const particles = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        angle: (i / 26) * Math.PI * 2 + Math.random() * 0.3,
        distance: 160 + Math.random() * 200,
        delay: Math.random() * 140,
        duration: 1300 + Math.random() * 900,
        size: 2 + Math.random() * 3,
      })),
    [open],
  );

  useEffect(() => {
    if (!open) return;
    try {
      playStreakSound();
    } catch {
      /* som é opcional */
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      setDisplay(Math.round((1 - Math.pow(1 - t, 3)) * streak));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, streak]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(onClose, 6000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 p-6 backdrop-blur-xl"
      onClick={onClose}
      role="dialog"
      aria-label="Parabéns pela tua ofensiva"
      style={{ animation: "mm-fade-in 260ms ease-out both" }}
    >
      <style>{`
        @keyframes mm-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes mm-halo {
          0% { transform: scale(0.4); opacity: 0 }
          40% { opacity: 1 }
          100% { transform: scale(2.6); opacity: 0 }
        }
        @keyframes mm-emblem {
          0% { transform: scale(0.6); opacity: 0 }
          55% { transform: scale(1.08); opacity: 1 }
          100% { transform: scale(1); opacity: 1 }
        }
        @keyframes mm-rise {
          0% { transform: translateY(20px); opacity: 0 }
          100% { transform: translateY(0); opacity: 1 }
        }
        @keyframes mm-flicker {
          0%, 100% { transform: scale(1) rotate(-2deg) }
          50% { transform: scale(1.07) rotate(2deg) }
        }
      `}</style>

      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: "radial-gradient(circle, oklch(0.82 0.13 82 / 0.55) 0%, transparent 70%)",
            animation: "mm-halo 1600ms ease-out both",
          }}
        />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
          {particles.map((p) => (
            <span
              key={p.id}
              className="absolute rounded-full"
              style={{
                width: p.size,
                height: p.size,
                background: "linear-gradient(180deg, oklch(0.92 0.14 90), oklch(0.72 0.15 78))",
                boxShadow: "0 0 8px oklch(0.85 0.14 85 / 0.9)",
                left: 0,
                top: 0,
                animation: `mm-streak-burst-${p.id} ${p.duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${p.delay}ms both`,
              }}
            />
          ))}
          <style>{particles
            .map(
              (p) => `
              @keyframes mm-streak-burst-${p.id} {
                0% { transform: translate(0,0) scale(1); opacity: 1 }
                80% { opacity: 1 }
                100% { transform: translate(${Math.cos(p.angle) * p.distance}px, ${Math.sin(p.angle) * p.distance}px) scale(0.4); opacity: 0 }
              }
            `,
            )
            .join("\n")}</style>
        </div>

        <div
          className="relative flex flex-col items-center px-8 py-10 text-center"
          style={{ animation: "mm-emblem 700ms cubic-bezier(0.16,1,0.3,1) both" }}
        >
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: "linear-gradient(135deg, oklch(0.86 0.14 88), oklch(0.62 0.14 72))",
              boxShadow:
                "0 20px 60px -12px oklch(0.75 0.15 80 / 0.6), inset 0 1px 0 oklch(1 0 0 / 0.4)",
              animation: "mm-flicker 1600ms ease-in-out infinite",
            }}
          >
            <Flame className="h-9 w-9 text-black" />
          </div>

          <p
            className="mt-8 text-[10px] font-semibold uppercase tracking-[0.32em] text-primary"
            style={{ animation: "mm-rise 500ms 250ms ease-out both" }}
          >
            Ofensiva a crescer
          </p>

          <p
            className="mt-3 font-display text-6xl text-white md:text-7xl"
            style={{ animation: "mm-rise 600ms 350ms cubic-bezier(0.16,1,0.3,1) both" }}
          >
            {display}
          </p>
          <p
            className="mt-1 text-sm uppercase tracking-[0.24em] text-white/60"
            style={{ animation: "mm-rise 500ms 450ms ease-out both" }}
          >
            dias seguidos
          </p>

          <p
            className="mt-5 max-w-xs text-sm text-white/75"
            style={{ animation: "mm-rise 500ms 650ms ease-out both" }}
          >
            {message(streak)}
          </p>

          <button
            type="button"
            onClick={onClose}
            className="mt-8 rounded-full border border-white/20 bg-white/5 px-5 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/80 backdrop-blur transition hover:border-white/40 hover:text-white"
            style={{ animation: "mm-rise 500ms 850ms ease-out both" }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
