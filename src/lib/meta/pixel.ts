/**
 * Meta Pixel (browser) — MM Club.
 *
 * Cada evento é enviado com um `event_id` único, o mesmo que segue para a
 * Conversions API no servidor, para o Meta deduplicar browser + servidor.
 */

export const META_PIXEL_ID = "993683323010678";

export type MetaEventName =
  | "PageView"
  | "ViewContent"
  | "Lead"
  | "CompleteRegistration"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "StartTrial"
  | "Purchase"
  | "Subscribe";

export type MetaEventData = {
  value?: number;
  currency?: string;
  content_name?: string;
  content_ids?: string[];
  content_type?: string;
  predicted_ltv?: number;
};

export type MetaUserData = {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  externalId?: string | null;
};

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[] };
  }
}

/** Script base do pixel — injetado no <head> pelo root. */
export const META_PIXEL_SCRIPT = `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
`;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function newEventId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

/**
 * Envia um evento para o pixel (browser) e para a Conversions API (servidor),
 * partilhando o mesmo event_id. Nunca lança — métricas não podem partir a app.
 */
export async function trackMeta(
  event: MetaEventName,
  data: MetaEventData = {},
  user: MetaUserData = {},
): Promise<void> {
  if (typeof window === "undefined") return;
  const eventId = newEventId();

  try {
    window.fbq?.("track", event, data, { eventID: eventId });
  } catch {
    /* ignore */
  }

  try {
    const { sendMetaConversion } = await import("./capi.functions");
    await sendMetaConversion({
      data: {
        eventName: event,
        eventId,
        eventSourceUrl: window.location.href,
        custom: data,
        user: {
          email: user.email ?? null,
          phone: user.phone ?? null,
          firstName: user.firstName ?? null,
          lastName: user.lastName ?? null,
          externalId: user.externalId ?? null,
          fbp: readCookie("_fbp"),
          fbc: readCookie("_fbc"),
        },
      },
    });
  } catch {
    /* CAPI é best-effort */
  }
}

/** PageView em cada mudança de rota (o script base não dispara sozinho). */
export function trackMetaPageView(): void {
  void trackMeta("PageView");
}
