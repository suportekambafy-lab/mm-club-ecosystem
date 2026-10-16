import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(), getPayment: vi.fn(), emitEvent: vi.fn(), ledger: vi.fn(),
  sync: vi.fn(), resolve: vi.fn(), refresh: vi.fn(), update: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("./gateway/index.server", () => ({ DEFAULT_GATEWAY: "paddle", getGateway: () => ({ name: "paddle", getPayment: mocks.getPayment }) }));
vi.mock("./catalog.server", () => ({ getPriceById: vi.fn().mockResolvedValue(null), getPriceBySlug: vi.fn(), gatewayInterval: vi.fn() }));
vi.mock("./events.server", () => ({ emitEvent: mocks.emitEvent }));
vi.mock("./ledger.server", () => ({ recordLedgerEntry: mocks.ledger }));
vi.mock("./payment-methods.server", () => ({ syncPaymentMethods: mocks.sync }));
vi.mock("./recovery/engine.server", () => ({ resolveRecoveryForPayment: mocks.resolve, startRecovery: vi.fn(), cancelRecoveryForSubscription: vi.fn() }));
vi.mock("./recovery/profile.server", () => ({ refreshCustomerProfile: mocks.refresh }));
vi.mock("./invoices.server", () => ({ ensureInvoiceForPayment: vi.fn() }));

import { handleGatewayPayment } from "./commands.server";

describe("Paddle migration reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPayment.mockResolvedValue({ id: "txn_verify", status: "paid", amountCents: 0, currency: "EUR", subscriptionId: "sub_paddle", metadata: { userId: "member" }, refundedCents: 0 });
    mocks.from.mockImplementation((table: string) => {
      let data = table === "billing_payments" ? { id: "payment", status: "pending", user_id: "member", price_id: "price", subscription_id: "sub_local" } : { id: "customer" };
      const q: Record<string, any> = {};
      for (const name of ["select", "eq", "upsert"]) q[name] = () => q;
      q.update = (patch: unknown) => { mocks.update(table, patch); return q; };
      q.maybeSingle = async () => ({ data, error: null });
      q.then = (resolve: (result: unknown) => unknown) => Promise.resolve(resolve({ data, error: null }));
      return q;
    });
  });
  it("links the verified card without renewing, recovering debt or recording revenue", async () => {
    await handleGatewayPayment("paddle", "txn_verify");
    expect(mocks.sync).toHaveBeenCalledWith("member");
    expect(mocks.update.mock.calls).toEqual([["billing_subscriptions", { gateway: "paddle", gateway_subscription_id: "sub_paddle" }]]);
    expect(mocks.emitEvent).not.toHaveBeenCalled();
    expect(mocks.ledger).not.toHaveBeenCalled();
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("keeps a later 29.90 euro collection on the revenue and recovery path", async () => {
    mocks.getPayment.mockResolvedValue({ id: "txn_charge", status: "paid", amountCents: 2990, currency: "EUR", subscriptionId: "sub_paddle", metadata: { userId: "member" }, refundedCents: 0 });
    await handleGatewayPayment("paddle", "txn_charge");
    expect(mocks.emitEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "PaymentSucceeded", payload: expect.objectContaining({ amountCents: 2990 }) }));
    expect(mocks.resolve).toHaveBeenCalledWith(expect.objectContaining({ paidCents: 2990, outcome: "paid" }));
  });
});