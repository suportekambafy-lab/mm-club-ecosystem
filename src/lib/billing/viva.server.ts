/**
 * Cliente mínimo da Viva.com (API clássica de ordens) — fetch puro, compatível com Workers.
 * Autenticação Basic VIVA_MERCHANT_ID:VIVA_API_KEY; VIVA_SOURCE_CODE é a fonte de pagamento
 * cujo URL de retorno aponta para /pagar/retorno. Recorrência: a ordem inicial é criada com
 * AllowRecurring e as cobranças seguintes usam o TransactionId do primeiro pagamento.
 */
const WWW = "https://www.vivapayments.com";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error("A Viva.com não está configurada.");
  return v;
}

function merchantAuth(): string {
  return `Basic ${btoa(`${env("VIVA_MERCHANT_ID")}:${env("VIVA_API_KEY")}`)}`;
}

async function viva(method: "GET" | "POST", path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${WWW}${path}`, {
    method,
    headers: { Authorization: merchantAuth(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok || (json && json.ErrorCode && json.ErrorCode !== 0)) {
    console.error("[viva]", method, path.split("?")[0], res.status, json?.ErrorText);
    throw new Error(json?.ErrorText || `Viva.com ${res.status}`);
  }
  return json;
}

/** Cria uma ordem e devolve o URL do checkout Viva. */
export async function createVivaOrder(input: {
  amountCents: number;
  title: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  reference: string;
  allowRecurring?: boolean;
}): Promise<{ orderCode: string; checkoutUrl: string }> {
  const json = await viva("POST", "/api/orders", {
    Amount: input.amountCents,
    CustomerTrns: input.title.slice(0, 2048),
    MerchantTrns: input.reference,
    SourceCode: env("VIVA_SOURCE_CODE"),
    PaymentTimeout: 1800,
    Email: input.email,
    FullName: input.name ?? undefined,
    Phone: input.phone ?? undefined,
    RequestLang: "pt-PT",
    AllowRecurring: input.allowRecurring ?? false,
  });
  const orderCode = String(json.OrderCode);
  return { orderCode, checkoutUrl: `${WWW}/web/checkout?ref=${orderCode}` };
}

/** Consulta a ordem diretamente na Viva: nunca confiamos no que chega pelo navegador. */
export async function getVivaOrderStatus(orderCode: string): Promise<{
  paid: boolean;
  amountCents: number | null;
  method: string | null;
  transactionId: string | null;
}> {
  const json = await viva("GET", `/api/transactions?ordercode=${encodeURIComponent(orderCode)}`);
  const txs: any[] = json?.Transactions ?? [];
  const ok = txs.find((t) => t?.StatusId === "F");
  if (!ok) return { paid: false, amountCents: null, method: null, transactionId: null };
  const method = /mbway|mb way/i.test(JSON.stringify(ok.PaymentMethod ?? ok.CardType ?? "")) ? "mb_way" : "card";
  return {
    paid: true,
    amountCents: Math.round(Number(ok.Amount) * 100),
    method,
    transactionId: ok.TransactionId ? String(ok.TransactionId) : null,
  };
}

/** Cobrança recorrente sobre a transação inicial autorizada (cliente ausente). */
export async function chargeVivaRecurring(input: {
  initialTransactionId: string;
  amountCents: number;
  description: string;
}): Promise<{ ok: true; transactionId: string | null } | { ok: false; error: string }> {
  try {
    const json = await viva("POST", `/api/transactions/${encodeURIComponent(input.initialTransactionId)}`, {
      Amount: input.amountCents,
      CustomerTrns: input.description.slice(0, 2048),
    });
    if (json?.StatusId && json.StatusId !== "F") return { ok: false, error: `Estado ${json.StatusId}` };
    return { ok: true, transactionId: json?.TransactionId ? String(json.TransactionId) : null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 300) : "erro" };
  }
}

/** Chave de verificação pedida pela Viva ao registar o webhook. */
export async function getVivaWebhookKey(): Promise<string> {
  const json = await viva("GET", "/api/messages/config/token");
  if (!json?.Key) throw new Error("Viva.com sem chave");
  return json.Key;
}
