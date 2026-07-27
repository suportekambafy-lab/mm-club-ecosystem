import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { useDeviceNotifications } from "@/lib/device-notifications";

const DISMISS_KEY = "mm.notifications.prompt.dismissed.v1";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Asks to enable device notifications on first PWA launch.
 * Only shows when installed (standalone), supported and permission is still "default".
 */
export function NotificationsPrompt() {
  const device = useDeviceNotifications();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!device.supported) return;
    if (device.permission !== "default") return;
    if (!isStandalone()) return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    const t = window.setTimeout(() => setShow(true), 1200);
    return () => window.clearTimeout(t);
  }, [device.supported, device.permission]);

  if (!show) return null;

  const close = () => {
    setShow(false);
    window.localStorage.setItem(DISMISS_KEY, "1");
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[9998] sm:inset-x-auto sm:right-4 sm:w-[360px]">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-1 p-4 shadow-2xl shadow-black/40 ring-1 ring-[color:var(--hairline)]">
        <button
          type="button"
          onClick={close}
          aria-label="Fechar"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BellRing className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm text-foreground">Ativar notificações</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Recebe avisos de lives a começar, respostas, gostos e menções — mesmo com a app fechada.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await device.enable();
                  close();
                }}
                className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-gold-soft"
              >
                Ativar
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-full bg-surface-2 px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
