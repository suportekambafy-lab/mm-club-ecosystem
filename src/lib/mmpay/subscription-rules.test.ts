import { describe, expect, it } from "vitest";
import { splitInstallments } from "./subscription-rules";

describe("splitInstallments", () => {
  it("divide 1 997 € em 2 prestações iguais", () => {
    expect(splitInstallments(199_700, 2)).toEqual([99_850, 99_850]);
  });

  it("distribui os cêntimos que sobram pelas primeiras prestações", () => {
    expect(splitInstallments(10_000, 3)).toEqual([3_334, 3_333, 3_333]);
  });

  it("a soma das prestações é sempre o total exato", () => {
    for (const [total, n] of [[199_700, 2], [10_000, 3], [49_701, 7], [100, 3]] as const) {
      const parts = splitInstallments(total, n);
      expect(parts).toHaveLength(n);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it("nunca gera prestações negativas nem zero quando o total cobre o mínimo", () => {
    const parts = splitInstallments(600, 6);
    expect(parts.every((p) => p >= 100)).toBe(true);
  });
});
