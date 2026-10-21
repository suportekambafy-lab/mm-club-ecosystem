/**
 * Cliente mínimo da API Klarna Payments (fetch + Basic auth) — compatível com Workers.
 * Usa as credenciais da conta Klarna do MM Club (KLARNA_API_USERNAME / KLARNA_API_PASSWORD).
 * Endpoint por omissão: produção UE. Para testes, definir KLARNA_API_BASE=https://api.playground.klarna.com
 */
function baseUrl(): string {
  return (process.env.KLARNA_API_BASE ?? "https://api.klarnacdn.com").replace(/\/$/, "");
}

function authHeader(): string {
  const uid = process.env.KLARNA_API_USERNAME;
  const pwd = process.env.KLARNA_API_PASSWORD;
  if (!uid || !pwd) throw new Error("Klarna não está configurada.");
  return `Basic ${btoa(`${uid}:${pwd}`)}`;
}

async function klarnaRequest<T = any>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* resposta sem JSON */
  }
  if (!res.ok) {
    const msg = json?.error_messages?.join?.("; ") ?? json?.message ?? `Klarna ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

type KlarnaOrderBody = {
  purchase_country: "PT";
  purchase_currency: "EUR";
  locale: "pt-PT";
  order_amount: number;
  order_tax_amount: 0;
  order_lines: Array<{
    type: "digital";
    name: string;
    quantity: 1;
    unit_price: number;
    total_amount: number;
    total_tax_amount: 0;
  }>;
  customer: { email: string };
  merchant_reference1?: string;
};

function orderBody(input: {
  amountCents: number;
  title: string;
  email: string;
  reference?: string;
}): KlarnaOrderBody {
  return {
    purchase_country: "PT",
    purchase_currency: "EUR",
    locale: "pt-PT",
    order_amount: input.amountCents,
    order_tax_amount: 0,
    order_lines: [
      {
        type: "digital",
        name: input.title.slice(0, 255),
        quantity: 1,
        unit_price: input.amountCents,
        total_amount: input.amountCents,
        total_tax_amount: 0,
      },
    ],
    customer: { email: input.email },
    merchant_reference1: input.reference,
  };
}

/** Cria uma sessão Klarna Payments; devolve o client_token para o widget no browser. */
export async function createKlarnaSession(input: {
  amountCents: number;
  title: string;
  email: string;
  reference: string;
}): Promise<{ sessionId: string; clientToken: string }> {
  const session = await klarnaRequest<{ session_id: string; client_token: string }>(
    "POST",
    "/payments/v1/sessions",
    { ...orderBody(input), intent: "buy" },
  );
  return { sessionId: session.session_id, clientToken: session.client_token };
}

/** Converte o authorization_token do widget numa ordem capturada (pagamento concluído). */
export async function placeKlarnaOrder(
  authorizationToken: string,
  input: { amountCents: number; title: string; email: string; reference: string },
): Promise<{ orderId: string }> {
  const order = await klarnaRequest<{ order_id: string }>(
    "POST",
    `/payments/v1/authorizations/${encodeURIComponent(authorizationToken)}/order`,
    orderBody(input),
  );
  return { orderId: order.order_id };
}
