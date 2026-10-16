import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ start: vi.fn(), status: vi.fn(), usage: vi.fn(), provision: vi.fn() }));
vi.mock("./livekit.server", () => ({ livekitRoomName: () => "test-room" }));
vi.mock("./live-egress.server", () => ({ startLiveRecording: mocks.start, getRecordingStatus: mocks.status, countRoomEgressFailures: vi.fn().mockResolvedValue(0) }));
vi.mock("./cloudflare-stream.server", () => ({ getStorageUsage: mocks.usage, createLiveInput: mocks.provision }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => {
  const q: Record<string, any> = {};
  for (const name of ["select", "eq", "update"]) q[name] = () => q;
  q.maybeSingle = async () => ({ data: { id: "test-live", status: "live", title: "Test", cf_rtmps_url: "rtmps://test", cf_stream_key: "test-only" } });
  return q;
} } }));
import { ensureLiveRecording } from "./live-recording.server";
describe("recording storage guard", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.status.mockResolvedValue([]); mocks.usage.mockResolvedValue({ full: true, usedMinutes: 1039.66, limitMinutes: 1000 }); });
  it("does not start rejected ingest when the account is full", async () => {
    const result = await ensureLiveRecording("test-live");
    expect(result.ok).toBe(false);
    expect(result.reason).not.toBeNull();
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.provision).not.toHaveBeenCalled();
  });
  it("does not interrupt an existing recording when quota is full", async () => {
    mocks.status.mockResolvedValue([{ status: "EGRESS_ACTIVE", egressId: null }]);
    expect((await ensureLiveRecording("test-live")).ok).toBe(true);
    expect(mocks.usage).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });
});