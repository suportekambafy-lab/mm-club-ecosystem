import { describe, expect, it } from "vitest";
import { parseVivaJson } from "./viva.server";

describe("parseVivaJson", () => {
  it("keeps 16-digit order codes exact", () => {
    const json = parseVivaJson('{"OrderCode":9486002723466153,"ErrorCode":0,"ErrorText":null}');
    expect(String(json.OrderCode)).toBe("9486002723466153");
    expect(json.ErrorCode).toBe(0);
  });
  it("leaves amounts and strings alone", () => {
    const json = parseVivaJson('{"Transactions":[{"Amount":12.5,"StatusId":"F","OrderCode": 9486002723466153 }]}');
    expect(json.Transactions[0].Amount).toBe(12.5);
    expect(json.Transactions[0].OrderCode).toBe("9486002723466153");
  });
  it("returns null for empty or invalid bodies", () => {
    expect(parseVivaJson("")).toBeNull();
    expect(parseVivaJson("<html>")).toBeNull();
  });
});
