import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), storageFrom: vi.fn(), deleteProduct: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: mocks.from, storage: { from: mocks.storageFrom } },
}));
vi.mock("./stripe.server", () => ({ deleteStripeProduct: mocks.deleteProduct }));
import { deleteMmpayLink } from "./mmpay.server";

beforeEach(() => vi.clearAllMocks());

it("deletes a duplicated link without deleting the cover shared by surviving products", async () => {
  const row = { id: "duplicate", stripe_product_id: "prod_duplicate", cover_url: "https://example.com/mmpay-covers/shared.png" };
  const deleteEq = vi.fn().mockResolvedValue({ error: null });
  mocks.from.mockReturnValueOnce({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) })
    .mockReturnValueOnce({ delete: () => ({ eq: deleteEq }) });
  await deleteMmpayLink("duplicate");
  expect(mocks.deleteProduct).toHaveBeenCalledWith("prod_duplicate");
  expect(deleteEq).toHaveBeenCalledWith("id", "duplicate");
  expect(mocks.storageFrom).not.toHaveBeenCalled();
});