import { resolvePaddlePrice } from "@/lib/paddle.functions";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as
  | string
  | undefined;

declare global {
  interface Window {
    Paddle: any;
  }
}

export function getPaddleEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

let paddleInitialized = false;

type PaddleEventHandler = (event: { name?: string; data?: any }) => void;
const eventHandlers = new Set<PaddleEventHandler>();

export function onPaddleEvent(handler: PaddleEventHandler): () => void {
  eventHandlers.add(handler);
  return () => {
    eventHandlers.delete(handler);
  };
}

function dispatchPaddleEvent(event: any) {
  eventHandlers.forEach((h) => {
    try {
      h(event);
    } catch (e) {
      console.error("Paddle event handler error", e);
    }
  });
}

export async function initializePaddle(): Promise<void> {
  if (paddleInitialized) return;
  if (!clientToken) {
    throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");
  }

  return new Promise<void>((resolve, reject) => {
    const doInit = () => {
      window.Paddle.Environment.set(
        getPaddleEnvironment() === "sandbox" ? "sandbox" : "production",
      );
      window.Paddle.Initialize({
        token: clientToken,
        eventCallback: dispatchPaddleEvent,
      });
      paddleInitialized = true;
      resolve();
    };
    if (window.Paddle) {
      doInit();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.onload = doInit;
    script.onerror = () => reject(new Error("Failed to load Paddle.js"));
    document.head.appendChild(script);
  });
}

export async function resolvePriceId(externalId: string): Promise<string> {
  return resolvePaddlePrice({
    data: { priceId: externalId, environment: getPaddleEnvironment() },
  });
}
