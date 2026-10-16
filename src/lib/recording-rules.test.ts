import { describe, expect, it } from "vitest";
import { recordingStorageBlock } from "./recording-rules";
describe("recording storage admission", () => {
  it("blocks new recording when storage is full", () => {
    expect(recordingStorageBlock({ full: true })).not.toBeNull();
  });
  it("permits recording when storage has capacity", () => {
    expect(recordingStorageBlock({ full: false })).toBeNull();
  });
});