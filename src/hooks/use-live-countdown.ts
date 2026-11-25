import { useEffect, useState } from "react";
import { useTicker } from "@/hooks/use-ticker";

export type LiveCountdown = { d: number; h: number; m: number; s: number };

/**
 * Contagem decrescente para uma sessão agendada.
 *
 * `running` deixa de fora as sessões que já estão no ar ou que já foram
 * gravadas — nessas não há contador, só o aviso de «ao vivo» ou de replay.
 */
export function useLiveCountdown(
  startsAt: string,
  running: boolean,
): LiveCountdown | null {
  const now = useTicker(1000);
  const [countdown, setCountdown] = useState<LiveCountdown | null>(null);

  useEffect(() => {
    if (!running) {
      setCountdown(null);
      return;
    }
    const diff = new Date(startsAt).getTime() - now;
    if (diff <= 0) {
      setCountdown({ d: 0, h: 0, m: 0, s: 0 });
      return;
    }
    const total = Math.floor(diff / 1000);
    setCountdown({
      d: Math.floor(total / 86400),
      h: Math.floor((total % 86400) / 3600),
      m: Math.floor((total % 3600) / 60),
      s: total % 60,
    });
  }, [startsAt, running, now]);

  return countdown;
}

/** «2d 4h 12m» — a versão curta do contador, para o telemóvel. */
export function formatCountdownShort(c: LiveCountdown): string {
  const parts: string[] = [];
  if (c.d > 0) parts.push(`${c.d}d`);
  if (c.d > 0 || c.h > 0) parts.push(`${c.h}h`);
  parts.push(`${c.m}m`);
  return parts.join(" ");
}
