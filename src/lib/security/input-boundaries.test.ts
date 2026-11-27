import { describe, expect, it } from "vitest";
import { csvCell, internalReturnPath, quotedContains, trustedPaymentOrigin } from "./input-boundaries";

describe("selected security input boundaries", () => {
  it("keeps filter grammar inside a quoted search value", () => {
    expect(quotedContains('a,b),name.eq."x')).toBe('"%a,b),name.eq.\\"x%"');
    expect(quotedContains("100%_done")).toBe('"%100\\%\\_done%"');
  });
  it.each(["=HYPERLINK(1)", "+cmd", "-cmd", "@SUM(1)", " \t=SUM(1)", "\tname"])("neutralizes spreadsheet formula %s", (v) => {
    expect(csvCell(v)).toBe(`"'${v}"`);
  });
  it("preserves normal export data and escapes quotes", () => {
    expect(csvCell('Victor "MM"')).toBe('"Victor ""MM"""');
    expect(csvCell(19700)).toBe('"19700"');
  });
  it.each(["https://attacker.example", "https://mmclub.pt.attacker.example", "https://attacker@mmclub.pt", "https://mmclub.pt/path"])("rejects external or malformed payment origin %s", (v) => {
    expect(() => trustedPaymentOrigin(v)).toThrow();
  });
  it("accepts the live and preview payment origins", () => {
    expect(trustedPaymentOrigin("https://mmclub.pt/")).toBe("https://mmclub.pt");
    expect(trustedPaymentOrigin("http://localhost:8080")).toBe("http://localhost:8080");
  });
  it.each(["//attacker.example", "/\\attacker.example", "https://attacker.example", "/\nmalicious"])("rejects external return path %s", (v) => {
    expect(() => internalReturnPath(v)).toThrow();
  });
  it("preserves local return path and query", () => {
    expect(internalReturnPath("/subscricao?pm=added")).toBe("/subscricao?pm=added");
  });
});