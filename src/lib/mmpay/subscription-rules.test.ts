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

import { firstThenSplit as _fts, installmentAmounts as _ia, isValidSchedule as _ivs } from "./subscription-rules";
import { describe as _d, it as _it, expect as _e } from "vitest";
_d("prestações personalizadas", () => {
  _it("1.º valor diferente: 1997 € com 500 € hoje → resto dividido em 2", () => {
    _e(_fts(199700, 3, 50000)).toEqual([50000, 74850, 74850]);
  });
  _it("valor de cada mês é usado quando soma o total", () => {
    _e(_ia(100000, 3, [20000, 30000, 50000])).toEqual([20000, 30000, 50000]);
  });
  _it("plano que não soma o total é rejeitado e volta a partes iguais", () => {
    _e(_ivs([20000, 30000], 100000, 2)).toBe(false);
    _e(_ia(100000, 2, [20000, 30000])).toEqual([50000, 50000]);
  });
  _it("prestação abaixo de 1 € é inválida", () => {
    _e(_ivs([99950, 50], 100000, 2)).toBe(false);
  });
});
