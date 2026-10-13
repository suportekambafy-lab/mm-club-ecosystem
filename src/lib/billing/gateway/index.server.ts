import { mollieGateway } from "./mollie.server";
import { paddleGateway } from "./paddle.server";
import { adyenGateway, stripeGateway } from "./stubs.server";
import type { PaymentGateway } from "./types";

const GATEWAYS: Record<string, PaymentGateway> = {
  mollie: mollieGateway,
  stripe: stripeGateway,
  paddle: paddleGateway,
  adyen: adyenGateway,
};

/**
 * The gateway new checkouts use. Existing rows keep their own gateway name
 * (e.g. old Mollie subscriptions) and are resolved with getGateway(row.gateway).
 */
export const DEFAULT_GATEWAY = "paddle";

export function getGateway(name: string = DEFAULT_GATEWAY): PaymentGateway {
  const gw = GATEWAYS[name];
  if (!gw) throw new Error(`Unknown payment gateway: ${name}`);
  return gw;
}

export type { PaymentGateway } from "./types";
