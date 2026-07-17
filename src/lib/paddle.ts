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

export async function initializePaddle(): Promise<void> {
  if (paddleInitialized) return;
  if (!clientToken) {
    throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");
  }

  return new Promise<void>((resolve, reject) => {
    if (window.Paddle) {
      window.Paddle.Environment.set(
        getPaddleEnvironment() === "sandbox" ? "sandbox" : "production",
      );
      window.Paddle.Initialize({ token: clientToken });
      paddleInitialized = true;
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.onload = () => {
      const paddleJsEnv =
        getPaddleEnvironment() === "sandbox" ? "sandbox" : "production";
      window.Paddle.Environment.set(paddleJsEnv);
      window.Paddle.Initialize({ token: clientToken });
      paddleInitialized = true;
      resolve();
    };
    script.onerror = () =>
      reject(new Error("Failed to load Paddle.js"));
    document.head.appendChild(script);
  });
}

export async function resolvePriceId(externalId: string): Promise<string> {
  return resolvePaddlePrice({
    data: { priceId: externalId, environment: getPaddleEnvironment() },
  });
}
