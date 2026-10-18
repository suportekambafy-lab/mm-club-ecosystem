import { expect, it } from "vitest";
import { canConfirmCommercialAccount } from "./confirmation-rules";

it("only admins may confirm commercial accounts", () => {
  expect(canConfirmCommercialAccount(false, ["closer"])).toBe(false);
  expect(canConfirmCommercialAccount(false, ["sdr"])).toBe(false);
});
it("allows confirming SDR and closer accounts without affecting ordinary members", () => {
  expect(canConfirmCommercialAccount(true, ["closer"])).toBe(true);
  expect(canConfirmCommercialAccount(true, ["sdr"])).toBe(true);
  expect(canConfirmCommercialAccount(true, ["user"])).toBe(false);
});