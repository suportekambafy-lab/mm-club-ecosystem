import { mollieGateway } from "./mollie.server";
import { adyenGateway, paddleGateway, stripeGateway } from "./stubs.server";
import type { PaymentGateway } from "./types";

const GATEWAYS: Record<string, PaymentGateway> = {
  mollie: mollieGateway,
  stripe: stripeGateway,
  paddle: paddleGateway,
  adyen: adyenGateway,
};

/** The gateway the engine transacts with today. Swappable without touching the domain. */
export const DEFAULT_GATEWAY = "mollie";

export function getGateway(name: string = DEFAULT_GATEWAY): PaymentGateway {
  const gw = GATEWAYS[name];
  if (!gw) throw new Error(`Unknown payment gateway: ${name}`);
  return gw;
}

export type { PaymentGateway } from "./types";
