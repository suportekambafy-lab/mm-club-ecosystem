import { expect, it } from "vitest";
import { commercialDestination } from "./login-rules";

it("returns commercial home by default", () => {
  expect(commercialDestination(undefined)).toBe("/comercial");
});
it("preserves a commercial destination", () => {
  expect(commercialDestination("/comercial/vendas")).toBe("/comercial/vendas");
});
it("rejects external and non-commercial destinations", () => {
  for (const value of ["https://example.com", "//example.com", "/admin", "/comercial/../admin", "/comercial-other"]) expect(commercialDestination(value)).toBe("/comercial");
});