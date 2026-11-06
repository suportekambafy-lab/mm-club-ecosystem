import { describe, expect, it } from "vitest";
import { createPaidSaleTracker } from "./paid-sale-tracker";

const sale = { id: "mmpay:1", amount: 19700, paidAt: "2026-11-06T22:01:00.000Z" };
describe("paid sale notifications", () => {
  it("does not ring for historical sales on entry", () => {
    expect(createPaidSaleTracker()([sale])).toEqual([]);
  });
  it("rings for a new paid sale with its exact euro-cent amount", () => {
    const track = createPaidSaleTracker();
    track([]);
    expect(track([sale])).toEqual([sale]);
  });
  it("does not repeat the same paid sale across overlapping polls", () => {
    const track = createPaidSaleTracker();
    track([]); track([sale]);
    expect(track([sale])).toEqual([]);
  });
  it("never celebrates zero-value card verification", () => {
    const track = createPaidSaleTracker(); track([]);
    expect(track([{ ...sale, amount: 0 }])).toEqual([]);
  });
  it("keeps different payment sources and concurrent sales separate", () => {
    const track = createPaidSaleTracker(); track([]);
    expect(track([sale, { ...sale, id: "charge:1" }, { ...sale, id: "billing:1" }])).toHaveLength(3);
  });
});