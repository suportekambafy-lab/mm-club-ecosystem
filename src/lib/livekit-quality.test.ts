import { describe, expect, it } from "vitest";
import { HQ_ROOM_OPTIONS, HQ_SCREEN_SHARE, HQ_SCREEN_PUBLISH } from "./livekit-quality";
import { screenContainRect } from "./live-media";

describe("screen sharing clarity", () => {
  it("preserves native screen resolution and detail rather than SVC motion", () => {
    expect(HQ_SCREEN_SHARE.resolution).toMatchObject({ width: 0, height: 0 });
    expect(HQ_SCREEN_SHARE.contentHint).toBe("detail");
    expect(HQ_SCREEN_PUBLISH.videoCodec).toBe("vp8");
    expect(HQ_SCREEN_PUBLISH.simulcast).toBe(false);
    expect(HQ_SCREEN_PUBLISH.degradationPreference).toBe("maintain-resolution");
    expect(HQ_SCREEN_PUBLISH.screenShareEncoding?.maxBitrate).toBe(7_000_000);
  });

  it("keeps camera settings unchanged", () => {
    expect(HQ_ROOM_OPTIONS.publishDefaults?.videoCodec).toBe("vp9");
    expect(HQ_ROOM_OPTIONS.videoCaptureDefaults?.resolution).toMatchObject({ width: 1920, height: 1080 });
  });

  it("fits a 16:10 display fully inside 1080p without clipping toolbars", () => {
    expect(screenContainRect(1920, 1200, 1920, 1080)).toEqual({ x: 96, y: 0, width: 1728, height: 1080 });
  });

  it("does not magnify a native 1080p display", () => {
    expect(screenContainRect(1920, 1080, 1920, 1080)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    expect(screenContainRect(0, 0, 1920, 1080)).toBeNull();
  });
});