import { describe, expect, it } from "vitest";
import { activeHeroKey, heroKeys } from "./hero-selection";

describe("destaques do Início", () => {
  it("coloca a live primeiro mesmo quando há MMCast", () => {
    const keys = heroKeys(true, true);
    expect(keys).toEqual(["live", "weekly", "mmcast"]);
    expect(activeHeroKey(keys, null, false)).toBe("live");
  });
  it("mantém uma live no ar em destaque", () => {
    expect(activeHeroKey(heroKeys(true, true), "mmcast", true)).toBe("live");
  });
  it("não inclui Legacy como destaque fixo", () => {
    expect(heroKeys(false, true)).toEqual(["weekly", "mmcast"]);
    expect(heroKeys(false, false)).toEqual(["weekly", "academy"]);
  });
});