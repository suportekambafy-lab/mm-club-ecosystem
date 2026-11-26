import { beforeEach, describe, expect, it, vi } from "vitest";
import { attachVideoSource } from "./attach-video-source";

const hls = vi.hoisted(() => ({ loadSource: vi.fn(), attachMedia: vi.fn(), destroy: vi.fn() }));
vi.mock("hls.js", () => ({ default: class {
  static isSupported() { return true; }
  loadSource = hls.loadSource;
  attachMedia = hls.attachMedia;
  destroy = hls.destroy;
} }));

function video(nativeHls = false) {
  return { src: "", canPlayType: () => nativeHls ? "maybe" : "", removeAttribute: vi.fn(), load: vi.fn() } as unknown as HTMLVideoElement;
}

describe("lesson video sources", () => {
  beforeEach(() => vi.clearAllMocks());
  it("attaches HLS in browsers without native support and destroys it on navigation", async () => {
    const el = video();
    const url = "https://videos.example/legacy/playlist.m3u8";
    const cleanup = attachVideoSource(el, url);
    await vi.waitFor(() => expect(hls.attachMedia).toHaveBeenCalledWith(el));
    expect(hls.loadSource).toHaveBeenCalledWith(url);
    cleanup();
    expect(hls.destroy).toHaveBeenCalledOnce();
  });
  it("retains native HLS playback", () => {
    const el = video(true);
    attachVideoSource(el, "https://videos.example/playlist.m3u8");
    expect(el.src).toBe("https://videos.example/playlist.m3u8");
    expect(hls.attachMedia).not.toHaveBeenCalled();
  });
  it("retains direct MP4 playback", () => {
    const el = video();
    attachVideoSource(el, "https://videos.example/lesson.mp4");
    expect(el.src).toBe("https://videos.example/lesson.mp4");
  });
  it("does not attach a stale stream after leaving the lesson", async () => {
    const cleanup = attachVideoSource(video(), "https://videos.example/playlist.m3u8");
    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(hls.attachMedia).not.toHaveBeenCalled();
  });
});