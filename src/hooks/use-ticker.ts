/**
 * Relógio central da app.
 *
 * Antes, cada contagem decrescente (lives, lançamento, aulas, banners) criava
 * o seu próprio `setInterval` de 1 segundo. Em páginas com vários contadores
 * isso significa vários temporizadores a acordar o telemóvel em momentos
 * diferentes. Aqui existe um único temporizador por cadência, partilhado por
 * todos os componentes, e é pausado quando o separador não está visível.
 */
import { useEffect, useState } from "react";

type Bucket = {
  handle: number | null;
  listeners: Set<(now: number) => void>;
};

const buckets = new Map<number, Bucket>();

function bucketFor(intervalMs: number): Bucket {
  let bucket = buckets.get(intervalMs);
  if (!bucket) {
    bucket = { handle: null, listeners: new Set() };
    buckets.set(intervalMs, bucket);
  }
  return bucket;
}

function start(intervalMs: number, bucket: Bucket) {
  if (bucket.handle !== null || typeof window === "undefined") return;
  bucket.handle = window.setInterval(() => {
    const now = Date.now();
    for (const listener of bucket.listeners) listener(now);
  }, intervalMs);
}

function stop(bucket: Bucket) {
  if (bucket.handle === null || typeof window === "undefined") return;
  window.clearInterval(bucket.handle);
  bucket.handle = null;
}

/** Subscreve o relógio partilhado. Devolve o instante atual em milissegundos. */
export function useTicker(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const bucket = bucketFor(intervalMs);
    const listener = (value: number) => setNow(value);
    bucket.listeners.add(listener);

    const sync = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        start(intervalMs, bucket);
      } else {
        stop(bucket);
      }
    };

    sync();
    document.addEventListener("visibilitychange", sync);

    return () => {
      document.removeEventListener("visibilitychange", sync);
      bucket.listeners.delete(listener);
      if (bucket.listeners.size === 0) stop(bucket);
    };
  }, [intervalMs]);

  return now;
}
