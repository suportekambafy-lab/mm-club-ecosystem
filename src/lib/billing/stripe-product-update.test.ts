import { afterEach, describe, expect, it, vi } from "vitest";
import { updateStripeProduct } from "./stripe.server";

const input = { productId: "prod_existing", priceId: "price_existing", name: "Mentoria atualizada", description: "Nova descrição", imageUrl: "https://mmclub.pt/capa.jpg", amountCents: 19700, previousAmountCents: 9700 };

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("MMpay product editing", () => {
  it("updates the same Stripe product with a new price while leaving old prices intact", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "test-only-not-a-credential");
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ id: "price_new" })).mockResolvedValueOnce(Response.json({ id: "prod_existing" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await updateStripeProduct(input)).toEqual({ productId: "prod_existing", priceId: "price_new" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.stripe.com/v1/prices");
    const price = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(price.get("unit_amount")).toBe("19700");
    expect(price.get("product")).toBe("prod_existing");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.stripe.com/v1/products/prod_existing");
    expect(new URLSearchParams(fetchMock.mock.calls[1][1].body).get("default_price")).toBe("price_new");
  });
  it("retains the price when editing title, description or cover without changing the amount", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "test-only-not-a-credential");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: "prod_existing" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await updateStripeProduct({ ...input, amountCents: 9700, description: null, imageUrl: null })).toEqual({ productId: "prod_existing", priceId: "price_existing" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const params = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(params.get("name")).toBe("Mentoria atualizada");
    expect(params.get("description")).toBe("");
    expect(params.get("images")).toBe("");
  });
});