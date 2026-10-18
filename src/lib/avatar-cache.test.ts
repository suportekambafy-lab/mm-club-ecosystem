import { describe, expect, it, vi } from "vitest";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from } } }));

import { cachedAvatarUrl, resolveAvatarUrl } from "./avatar-cache";
import guadalupe from "@/assets/guadalupe-costa.jpg.asset.json";
import elizangela from "@/assets/elizangela-dos-santos.png.asset.json";

describe("team account avatar resolution", () => {
  it.each([guadalupe, elizangela])("uses the team photograph directly: $original_filename", async (asset) => {
    expect(cachedAvatarUrl(asset.url)).toBe(asset.url);
    expect(await resolveAvatarUrl(asset.url)).toBe(asset.url);
    expect(from).not.toHaveBeenCalled();
  });
});