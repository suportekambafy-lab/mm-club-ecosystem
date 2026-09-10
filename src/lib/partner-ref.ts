/**
 * Captura do convite MM Partners (?ref=CODIGO) no navegador.
 * O código fica guardado 90 dias e é ligado à conta no primeiro login.
 */
const KEY = "mm_partner_ref";
const MAX_AGE_MS = 90 * 86400000;

type Stored = { code: string; at: number };

export function capturePartnerRef(): void {
  if (typeof window === "undefined") return;
  const code = new URLSearchParams(window.location.search).get("ref");
  if (!code) return;
  const clean = code.trim().toUpperCase().slice(0, 20);
  if (!/^[A-Z0-9]{4,20}$/.test(clean)) return;
  try {
    const current = readStored();
    if (current) return; // primeira origem ganha
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ code: clean, at: Date.now() } satisfies Stored),
    );
    document.cookie = `${KEY}=${clean};path=/;max-age=${Math.floor(MAX_AGE_MS / 1000)};samesite=lax`;
  } catch {
    /* armazenamento indisponível */
  }
}

function readStored(): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Stored;
      if (parsed?.code && Date.now() - parsed.at < MAX_AGE_MS) return parsed.code;
    }
  } catch {
    /* ignore */
  }
  const match = document.cookie.match(new RegExp(`${KEY}=([A-Z0-9]+)`));
  return match?.[1] ?? null;
}

export function pendingPartnerRef(): string | null {
  if (typeof window === "undefined") return null;
  return readStored();
}

export function clearPartnerRef(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  document.cookie = `${KEY}=;path=/;max-age=0`;
}
