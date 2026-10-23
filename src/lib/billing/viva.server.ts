/**
 * Cliente mínimo da Viva.com (Smart Checkout) — fetch puro, compatível com Workers.
 * Credenciais: VIVA_CLIENT_ID / VIVA_CLIENT_SECRET (OAuth Smart Checkout),
 * VIVA_MERCHANT_ID / VIVA_API_KEY (consulta de transações e webhooks),
 * VIVA_SOURCE_CODE (fonte de pagamento com o URL de retorno /pagar/retorno).
 */
const ACCOUNTS = "https://accounts.vivapayments.com";
const API = "https://api.vivapayments.com";
const WWW = "https://www.vivapayments.com";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error("A Viva.com não está configurada.");
  return v;
}

async function accessToken(): Promise<string> {
  const res = await fetch(`${ACCOUNTS}/connect/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${env("VIVA_CLIENT_ID")}:${env("VIVA_CLIENT_SECRET")}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok || !json?.access_token) throw new Error(`Viva.com recusou as credenciais (${res.status}).`);
  return json.access_token;
}

function merchantAuth(): string {
  return `Basic ${btoa(`${env("VIVA_MERCHANT_ID")}:${env("VIVA_API_KEY")}`)}`;
}

/** Cria uma ordem de pagamento e devolve o URL do checkout Viva. */
export async function createVivaOrder(input: {
  amountCents: number;
  title: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  reference: string;
}): Promise<{ orderCode: string; checkoutUrl: string }> {
  const token = await accessToken();
  const res = await fetch(`${API}/checkout/v2/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: input.amountCents,
      customerTrns: input.title.slice(0, 2048),
      merchantTrns: input.reference,
      sourceCode: env("VIVA_SOURCE_CODE"),
      paymentTimeout: 1800,
      customer: {
        email: input.email,
        fullName: input.name ?? undefined,
        phone: input.phone ?? undefined,
        requestLang: "pt-PT",
      },
    }),
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok || !json?.orderCode) {
    console.error("[viva] create order", res.status, json);
    throw new Error("Não foi possível iniciar o pagamento. Tenta novamente.");
  }
  const orderCode = String(json.orderCode);
  return { orderCode, checkoutUrl: `${WWW}/web/checkout?ref=${orderCode}` };
}

/** Consulta a ordem diretamente na Viva: nunca confiamos no que chega pelo navegador. */
export async function getVivaOrderStatus(orderCode: string): Promise<{
  paid: boolean;
  amountCents: number | null;
  method: string | null;
}> {
  const res = await fetch(`${WWW}/api/transactions?ordercode=${encodeURIComponent(orderCode)}`, {
    headers: { Authorization: merchantAuth() },
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Viva.com ${res.status}`);
  const txs: any[] = json?.Transactions ?? [];
  const ok = txs.find((t) => t?.StatusId === "F");
  if (!ok) return { paid: false, amountCents: null, method: null };
  const method = ok.PaymentMethodId === 31 || /mbway/i.test(JSON.stringify(ok)) ? "mb_way" : "card";
  return { paid: true, amountCents: Math.round(Number(ok.Amount) * 100), method };
}

/** Chave de verificação pedida pela Viva ao registar o webhook. */
export async function getVivaWebhookKey(): Promise<string> {
  const res = await fetch(`${WWW}/api/messages/config/token`, { headers: { Authorization: merchantAuth() } });
  const json: any = await res.json().catch(() => null);
  if (!res.ok || !json?.Key) throw new Error(`Viva.com ${res.status}`);
  return json.Key;
}
