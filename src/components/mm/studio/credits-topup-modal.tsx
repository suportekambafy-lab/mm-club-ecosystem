import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, ChevronDown, Check, Zap, Image as ImageIcon, Video } from "lucide-react";
import { STUDIO_COSTS } from "@/lib/studio-config";
import { supabase } from "@/integrations/supabase/client";
import { createMollieCreditOrder } from "@/lib/mollie.functions";
import { CREDIT_PACKS, type CreditPack } from "@/lib/studio-credit-packs";
import { useStudio } from "@/lib/studio-context";
import { CreditsCelebration } from "./credits-celebration";

type Props = {
  open: boolean;
  onClose: () => void;
};

type StudioContextData = {
  credits?: { balance?: number };
  [k: string]: unknown;
};

export function CreditsTopupModal({ open, onClose }: Props) {
  const { refresh, balance } = useStudio();
  const qc = useQueryClient();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultPack = useMemo(
    () => CREDIT_PACKS.find((p) => p.highlight) ?? CREDIT_PACKS[0],
    [],
  );
  const [selectedId, setSelectedId] = useState<string>(defaultPack.id);
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => CREDIT_PACKS.find((p) => p.id === selectedId) ?? defaultPack,
    [selectedId, defaultPack],
  );

  const [celebrateOpen, setCelebrateOpen] = useState(false);
  const [celebrateCredits, setCelebrateCredits] = useState<number | null>(null);
  const [celebrateBalance, setCelebrateBalance] = useState<number | null>(null);
  const lastPackRef = useRef<CreditPack | null>(null);
  const baselineBalanceRef = useRef<number>(0);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDropOpen(false);
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ id: data.user.id, email: data.user.email ?? undefined });
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (dropOpen) setDropOpen(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, dropOpen]);

  useEffect(() => {
    if (!dropOpen) return;
    const onClick = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [dropOpen]);

  // When the user returns from Mollie with ?topup=success, celebrate and
  // poll the backend until the webhook credits the balance.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("topup") !== "success") return;

    // Clean the URL so a refresh doesn't retrigger.
    params.delete("topup");
    const clean = window.location.pathname + (params.toString() ? `?${params}` : "");
    window.history.replaceState({}, "", clean);

    // Try to recall the last pack the user selected before redirect.
    let pack: CreditPack | null = null;
    try {
      const stored = window.sessionStorage.getItem("mm:lastTopupPackId");
      if (stored) pack = CREDIT_PACKS.find((p) => p.id === stored) ?? null;
      window.sessionStorage.removeItem("mm:lastTopupPackId");
    } catch { /* ignore */ }
    if (!pack) pack = CREDIT_PACKS.find((p) => p.highlight) ?? CREDIT_PACKS[0];

    const baseline = balance ?? 0;
    const optimistic = baseline + pack.credits;

    setCelebrateCredits(pack.credits);
    setCelebrateBalance(optimistic);
    setCelebrateOpen(true);

    let attempts = 0;
    const maxAttempts = 30;
    const poll = async () => {
      attempts += 1;
      await refresh();
      const data = qc.getQueryData<StudioContextData>(["studio", "context"]);
      const current = data?.credits?.balance ?? 0;
      if (current >= optimistic) {
        setCelebrateBalance(current);
        return;
      }
      if (attempts < maxAttempts) {
        window.setTimeout(poll, 2000);
      }
    };
    window.setTimeout(poll, 800);
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBuy = async () => {
    if (!user?.id) {
      setError("Precisas de sessão iniciada para carregar créditos.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      lastPackRef.current = selected;
      baselineBalanceRef.current = balance ?? 0;
      try {
        window.sessionStorage.setItem("mm:lastTopupPackId", selected.id);
      } catch { /* ignore */ }
      const res = await createMollieCreditOrder({
        data: {
          packId: selected.id,
          origin: window.location.origin,
        },
      });
      window.location.href = res.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível abrir o checkout.");
      setPending(false);
    }
  };


  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 backdrop-blur-md md:items-center"
          onClick={onClose}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-[color:var(--hairline)] bg-surface-1 md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="px-6 pb-4 pt-7 md:px-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
                Carregar créditos
              </p>
              <h2 className="mt-2 font-display text-2xl text-foreground">
                Adiciona créditos ao MM Studio
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Saldo atual{" "}
                <span className="font-semibold text-foreground">
                  {(balance ?? 0).toLocaleString("pt-PT")}
                </span>{" "}
                créditos.
              </p>
            </div>

            {/* Content */}
            <div className="space-y-5 px-6 pb-6 md:px-8">
              {/* Pack selector */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Pack
                </label>
                <div ref={dropRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setDropOpen((v) => !v)}
                    aria-haspopup="listbox"
                    aria-expanded={dropOpen}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-[color:var(--hairline)] bg-background/40 px-4 py-3.5 text-left transition hover:border-primary/50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-display text-lg text-foreground">
                          {selected.credits.toLocaleString("pt-PT")} créditos
                        </span>
                        {selected.highlight && (
                          <span className="inline-flex shrink-0 items-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 flex items-center gap-2 truncate text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          {Math.floor(selected.credits / STUDIO_COSTS.imageSingle)} imagens
                        </span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Video className="h-3 w-3" />
                          {Math.floor(selected.credits / STUDIO_COSTS.video)} vídeos
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-display text-lg text-foreground">
                        {selected.price}
                      </span>
                      <ChevronDown
                        className={
                          "h-4 w-4 text-muted-foreground transition " +
                          (dropOpen ? "rotate-180" : "")
                        }
                      />
                    </div>
                  </button>

                  {dropOpen && (
                    <div
                      role="listbox"
                      className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-72 overflow-auto rounded-2xl border border-[color:var(--hairline)] bg-surface-1 p-1 shadow-2xl"
                    >
                      {CREDIT_PACKS.map((pack) => {
                        const active = pack.id === selectedId;
                        return (
                          <button
                            key={pack.id}
                            type="button"
                            role="option"
                            aria-selected={active}
                            onClick={() => {
                              setSelectedId(pack.id);
                              setDropOpen(false);
                            }}
                            className={
                              "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2.5 text-left transition " +
                              (active
                                ? "bg-primary/10"
                                : "hover:bg-foreground/5")
                            }
                          >
                            <span
                              className={
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border " +
                                (active
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-[color:var(--hairline)]")
                              }
                            >
                              {active && <Check className="h-3 w-3" />}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-semibold text-foreground">
                                  {pack.credits.toLocaleString("pt-PT")} créditos
                                </span>
                                {pack.highlight && (
                                  <span className="inline-flex shrink-0 items-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">
                                    Popular
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 flex items-center gap-2 truncate text-[11px] text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <ImageIcon className="h-3 w-3" />
                                  {Math.floor(pack.credits / STUDIO_COSTS.imageSingle)} img
                                </span>
                                <span className="text-muted-foreground/40">·</span>
                                <span className="inline-flex items-center gap-1">
                                  <Video className="h-3 w-3" />
                                  {Math.floor(pack.credits / STUDIO_COSTS.video)} vídeos
                                </span>
                              </p>
                            </div>
                            <span className="shrink-0 text-sm font-semibold text-foreground">
                              {pack.price}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-2xl border border-[color:var(--hairline)] bg-background/40 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">A adicionar</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    {selected.credits.toLocaleString("pt-PT")}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Novo saldo</span>
                  <span className="font-semibold text-foreground">
                    {((balance ?? 0) + selected.credits).toLocaleString("pt-PT")}
                  </span>
                </div>
                <div className="mt-3 border-t border-[color:var(--hairline)] pt-3 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Total
                  </span>
                  <span className="font-display text-xl text-foreground">
                    {selected.price}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleBuy}
                disabled={pending}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
              >
                {pending ? "A abrir checkout…" : `Carregar ${selected.price}`}
              </button>

              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}

            </div>
          </div>
        </div>
      )}

      <CreditsCelebration
        open={celebrateOpen}
        credits={celebrateCredits}
        newBalance={celebrateBalance}
        onClose={() => setCelebrateOpen(false)}
      />
    </>
  );
}
