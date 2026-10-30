import type { JobPayload } from "../types";
import { loadMmpaySale } from "./mmpay-sale.server";

export async function crmConsumer(job: JobPayload): Promise<void> {
  const secret = process.env["CRM_WEBHOOK_SECRET"];
  if (!secret) throw new Error("CRM webhook is not configured");
  const sale = await loadMmpaySale(job);
  if (!sale) return;
  const url = new URL("https://marcamilionaria.com/api/public/kambafy-webhook");
  url.searchParams.set("secret", secret);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", "Idempotency-Key": sale.id },
      body: JSON.stringify(sale),
    });
  } catch {
    // Fetch errors can contain the URL, including its credential. Never log it.
    throw new Error("CRM sale delivery unavailable");
  }
  if (!response.ok) throw new Error(`CRM did not acknowledge sale (HTTP ${response.status})`);
}