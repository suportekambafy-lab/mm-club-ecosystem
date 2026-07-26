import { GatewayNotImplemented, type PaymentGateway } from "./types";

/**
 * Typed stubs. They exist to prove the PaymentGateway interface is generic
 * and not shaped around Mollie. Implement when a gateway is actually added.
 */
function stub(name: string): PaymentGateway {
  const fail = (method: string) => {
    throw new GatewayNotImplemented(name, method);
  };
  return {
    name,
    environment: "test",
    createCustomer: async () => fail("createCustomer"),
    createCharge: async () => fail("createCharge"),
    getPayment: async () => fail("getPayment"),
    refundPayment: async () => fail("refundPayment"),
    listMandates: async () => fail("listMandates"),
    chargeWithMandate: async () => fail("chargeWithMandate"),

    createSubscription: async () => fail("createSubscription"),
    cancelSubscription: async () => fail("cancelSubscription"),
    normalizeWebhook: async () => fail("normalizeWebhook"),
  };
}

export const stripeGateway = stub("stripe");
export const paddleGateway = stub("paddle");
export const adyenGateway = stub("adyen");
