import { createVivaOrder, getVivaOrderStatus } from "../viva.server";
import { GatewayNotImplemented, type GatewayPayment, type PaymentGateway } from "./types";

/**
 * Viva.com para compras avulsas (ex.: packs de créditos do MM Studio).
 * O id do pagamento é o OrderCode da Viva; o estado é sempre consultado na Viva.
 * Sem recorrência: as assinaturas continuam no gateway predefinido.
 */
const fail = (method: string): never => {
  throw new GatewayNotImplemented("viva", method);
};

function base(id: string): GatewayPayment {
  return {
    id,
    status: "pending",
    amountCents: 0,
    currency: "EUR",
    method: null,
    subscriptionId: null,
    mandateId: null,
    customerId: null,
    refundedCents: 0,
    metadata: {},
    checkoutUrl: null,
    paidAt: null,
    failureReason: null,
  };
}

export const vivaGateway: PaymentGateway = {
  name: "viva",
  environment: "live",
  createCustomer: async () => ({ id: "" }),
  async createCharge(input) {
    if (input.setupRecurring || input.recurring) fail("recurring");
    const order = await createVivaOrder({
      amountCents: input.amountCents,
      title: input.description,
      email: input.customerEmail ?? "",
      reference: String(input.metadata.priceSlug ?? "mmclub"),
    });
    return { ...base(order.orderCode), amountCents: input.amountCents, checkoutUrl: order.checkoutUrl };
  },
  async getPayment(id) {
    const s = await getVivaOrderStatus(id);
    if (!s.paid) return base(id);
    return {
      ...base(id),
      status: "paid",
      amountCents: s.amountCents ?? 0,
      method: s.method,
      paidAt: new Date().toISOString(),
    };
  },
  refundPayment: async () => fail("refundPayment"),
  listMandates: async () => [],
  chargeWithMandate: async () => fail("chargeWithMandate"),
  createSubscription: async () => fail("createSubscription"),
  cancelSubscription: async () => fail("cancelSubscription"),
  normalizeWebhook: async () => null,
};
