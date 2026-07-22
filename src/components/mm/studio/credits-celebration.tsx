import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles } from "lucide-react";

type Props = {
  open: boolean;
  credits: number | null;
  newBalance: number | null;
  onClose: () => void;
};

/**
 * Premium, minimal celebration for credit top-ups.
 * Golden particle burst + counter reveal. No confetti kitsch.
 */
export function CreditsCelebration({ open, credits, newBalance, onClose }: Props) {
  const [display, setDisplay] = useState(0);

  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        angle: (i / 28) * Math.PI * 2 + Math.random() * 0.3,
        distance: 180 + Math.random() * 220,
        delay: Math.random() * 120,
        duration: 1400 + Math.random() * 900,
        size: 2 + Math.random() * 3,
      })),
    [open],
  );

  useEffect(() => {
    if (!open || !credits) return;
    const target = credits;
    const start = performance.now();
    const duration = 1400;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, credits]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(onClose, 4200);
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
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 backdrop-blur-xl"
      onClick={onClose}
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
        @keyframes mm-shine {
          0% { background-position: -200% 0 }
          100% { background-position: 200% 0 }
        }
      `}</style>

      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {/* Halo rings */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, oklch(0.82 0.13 82 / 0.55) 0%, transparent 70%)",
            animation: "mm-halo 1600ms ease-out both",
          }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border"
          style={{
            borderColor: "oklch(0.82 0.13 82 / 0.35)",
            animation: "mm-halo 2200ms 180ms ease-out both",
          }}
        />

        {/* Golden particles */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
          {particles.map((p) => {
            const x = Math.cos(p.angle) * p.distance;
            const y = Math.sin(p.angle) * p.distance;
            return (
              <span
                key={p.id}
                className="absolute rounded-full"
                style={{
                  width: p.size,
                  height: p.size,
                  background:
                    "linear-gradient(180deg, oklch(0.92 0.14 90), oklch(0.72 0.15 78))",
                  boxShadow: "0 0 8px oklch(0.85 0.14 85 / 0.9)",
                  left: 0,
                  top: 0,
                  transform: "translate(0,0)",
                  animation: `mm-burst-${p.id} ${p.duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${p.delay}ms both`,
                }}
              />
            );
          })}
          <style>{particles
            .map(
              (p) => `
              @keyframes mm-burst-${p.id} {
                0% { transform: translate(0,0) scale(1); opacity: 1 }
                80% { opacity: 1 }
                100% { transform: translate(${Math.cos(p.angle) * p.distance}px, ${Math.sin(p.angle) * p.distance}px) scale(0.4); opacity: 0 }
              }
            `,
            )
            .join("\n")}</style>
        </div>

        {/* Emblem + counter */}
        <div
          className="relative flex flex-col items-center px-10 py-12 text-center"
          style={{ animation: "mm-emblem 700ms cubic-bezier(0.16,1,0.3,1) both" }}
        >
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.86 0.14 88), oklch(0.62 0.14 72))",
              boxShadow:
                "0 20px 60px -12px oklch(0.75 0.15 80 / 0.6), inset 0 1px 0 oklch(1 0 0 / 0.4)",
            }}
          >
            <Sparkles className="h-9 w-9 text-black" />
          </div>

          <p
            className="mt-8 text-[10px] font-semibold uppercase tracking-[0.32em] text-primary"
            style={{ animation: "mm-rise 500ms 300ms ease-out both" }}
          >
            Créditos adicionados
          </p>

          <p
            className="mt-3 font-display text-6xl md:text-7xl"
            style={{
              animation: "mm-rise 600ms 400ms cubic-bezier(0.16,1,0.3,1) both",
              backgroundImage:
                "linear-gradient(90deg, oklch(0.95 0.06 88), oklch(0.78 0.14 82), oklch(0.95 0.06 88))",
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              animationName: "mm-rise, mm-shine",
              animationDuration: "600ms, 2400ms",
              animationDelay: "400ms, 400ms",
              animationTimingFunction: "cubic-bezier(0.16,1,0.3,1), linear",
              animationIterationCount: "1, infinite",
              animationFillMode: "both, both",
            }}
          >
            +{(credits ?? 0) === 0 ? 0 : display.toLocaleString("pt-PT")}
          </p>

          {newBalance !== null && (
            <p
              className="mt-4 text-sm text-white/70"
              style={{ animation: "mm-rise 500ms 900ms ease-out both" }}
            >
              Novo saldo:{" "}
              <span className="font-semibold text-white">
                {newBalance.toLocaleString("pt-PT")}
              </span>{" "}
              créditos
            </p>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-8 rounded-full border border-white/20 bg-white/5 px-5 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/80 backdrop-blur transition hover:border-white/40 hover:text-white"
            style={{ animation: "mm-rise 500ms 1100ms ease-out both" }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
