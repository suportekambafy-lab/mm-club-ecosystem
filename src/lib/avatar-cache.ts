/**
 * Cache de URLs assinados de avatares.
 *
 * Os avatares vivem num bucket privado, por isso cada carregamento pedia um
 * novo signed URL — o que fazia a foto "aparecer" só depois de a página já
 * estar desenhada. Guardamos o URL (com validade) em memória e em
 * localStorage para que o avatar apareça instantaneamente na navegação
 * seguinte, e só renovamos em segundo plano quando está quase a expirar.
 */
import { supabase } from "@/integrations/supabase/client";

const STORE_KEY = "mm:avatar_urls";
const TTL_MS = 60 * 60 * 1000; // signed URLs válidos 1h
const REFRESH_BEFORE_MS = 10 * 60 * 1000;

type Entry = { url: string; exp: number };

let memory: Record<string, Entry> | null = null;
const inflight = new Map<string, Promise<string | null>>();

function store(): Record<string, Entry> {
  if (memory) return memory;
  memory = {};
  if (typeof window !== "undefined") {
    try {
      memory = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "{}") as Record<
        string,
        Entry
      >;
    } catch {
      memory = {};
    }
  }
  return memory;
}

function persist() {
  if (typeof window === "undefined" || !memory) return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(memory));
  } catch {
    /* storage cheio/indisponível */
  }
}

/** URL já conhecido para este caminho (sincronamente), ou null. */
export function cachedAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  const entry = store()[path];
  if (!entry || entry.exp <= Date.now()) return null;
  return entry.url;
}

/** Resolve (e memoriza) o signed URL do avatar. */
export function resolveAvatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return Promise.resolve(null);
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return Promise.resolve(path);

  const entry = store()[path];
  const fresh = entry && entry.exp - REFRESH_BEFORE_MS > Date.now();
  if (fresh) return Promise.resolve(entry.url);

  const existing = inflight.get(path);
  if (existing) return existing;

  const task = (async () => {
    let url: string | null = null;
    // duas tentativas: um erro de rede pontual deixava o avatar como "?"
    for (let attempt = 0; attempt < 2 && !url; attempt += 1) {
      try {
        const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
        url = data?.signedUrl ?? null;
      } catch {
        url = null;
      }
      if (!url && attempt === 0) await new Promise((r) => setTimeout(r, 400));
    }
    if (url) {
      store()[path] = { url, exp: Date.now() + TTL_MS };
      persist();
      // pré-carrega para o <img> aparecer sem flash
      if (typeof window !== "undefined") {
        const img = new Image();
        img.decoding = "async";
        img.src = url;
      }
    } else if (memory && memory[path] && memory[path].exp <= Date.now()) {
      delete memory[path];
      persist();
    }
    inflight.delete(path);
    return url ?? entry?.url ?? null;
  })();

  inflight.set(path, task);
  return task;
}

