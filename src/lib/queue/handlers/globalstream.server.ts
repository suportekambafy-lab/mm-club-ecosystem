import type { JobPayload } from "../types";
import { loadMmpaySale } from "./mmpay-sale.server";

export async function globalstreamConsumer(job: JobPayload): Promise<void> {
  const secret = process.env["GLOBALSTREAM_WEBHOOK_SECRET"];
  if (!secret) throw new Error("GlobalStream webhook is not configured");
  const sale = await loadMmpaySale(job);
  if (!sale) return;
  const body = JSON.stringify(sale);
  const response = await fetch("https://www.globalstream.live/api/public/hooks/62c76976bfa047158a21cd72ed4883bd", {
    // Workers reject redirect:"error" before sending the request. Manual
    // redirects preserve the same no-forwarding policy for the secret.
    method: "POST", redirect: "manual", signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}`, "Idempotency-Key": sale.id }, body,
  });
  if (!response.ok) {
    throw new Error(`GlobalStream did not acknowledge sale (HTTP ${response.status})`);
  }
}