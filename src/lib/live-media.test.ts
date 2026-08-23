import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  cameraErrorMessage,
  screenShareErrorMessage,
  sortStageTiles,
  tilesSignature,
  participantInitials,
} from "./live-media";
import { readMediaPrefs, writeMediaPrefs, defaultMediaPrefs } from "./media-prefs";

describe("cameraErrorMessage", () => {
  it("explica permissão bloqueada", () => {
    const err = new Error("Permission denied");
    err.name = "NotAllowedError";
    expect(cameraErrorMessage(err)).toMatch(/Permissão de câmara bloqueada/);
  });

  it("explica câmara ocupada por outra app", () => {
    const err = new Error("could not start video source");
    err.name = "NotReadableError";
    expect(cameraErrorMessage(err)).toMatch(/outra aplicação/);
  });

  it("explica ausência de câmara", () => {
    const err = new Error("no device");
    err.name = "NotFoundError";
    expect(cameraErrorMessage(err)).toMatch(/nenhuma câmara/);
  });

  it("tem fallback para erros desconhecidos", () => {
    expect(cameraErrorMessage(null)).toMatch(/Tenta de novo/);
    expect(cameraErrorMessage("boom")).toMatch(/Tenta de novo/);
  });
});

describe("screenShareErrorMessage", () => {
  it("ignora cancelamento do utilizador", () => {
    const err = new Error("Permission denied");
    err.name = "NotAllowedError";
    expect(screenShareErrorMessage(err)).toBeNull();
  });

  it("sugere pedir palco quando faltam permissões", () => {
    expect(screenShareErrorMessage(new Error("insufficient permissions"))).toMatch(
      /palco/,
    );
  });

  it("tem fallback genérico", () => {
    expect(screenShareErrorMessage(new Error("weird"))).toMatch(/partilhar o ecrã/);
  });
});

describe("sortStageTiles", () => {
  const tiles = [
    { id: "zoe" },
    { id: "ana", isHost: true },
    { id: "bruno-screen", isScreen: true },
    { id: "bruno" },
  ];

  it("põe ecrã primeiro, depois hosts, depois alfabético", () => {
    expect(sortStageTiles(tiles).map((t) => t.id)).toEqual([
      "bruno-screen",
      "ana",
      "bruno",
      "zoe",
    ]);
  });

  it("é estável e não muta a lista original", () => {
    const first = sortStageTiles(tiles).map((t) => t.id);
    const second = sortStageTiles(sortStageTiles(tiles)).map((t) => t.id);
    expect(second).toEqual(first);
    expect(tiles[0]?.id).toBe("zoe");
  });
});

describe("tilesSignature", () => {
  it("muda quando o track muda", () => {
    const a = tilesSignature([{ id: "x", name: "X", trackId: "t1" }]);
    const b = tilesSignature([{ id: "x", name: "X", trackId: "t2" }]);
    expect(a).not.toBe(b);
  });

  it("mantém-se igual quando nada muda (evita flicker)", () => {
    const list = [
      { id: "x", name: "X", trackId: "t1" },
      { id: "y", name: "Y", trackId: null },
    ];
    expect(tilesSignature(list)).toBe(tilesSignature([...list]));
  });
});

describe("participantInitials", () => {
  it("usa até duas iniciais", () => {
    expect(participantInitials("Victor Muabi")).toBe("VM");
    expect(participantInitials("maria   silva santos")).toBe("MS");
    expect(participantInitials("ana")).toBe("A");
    expect(participantInitials("   ")).toBe("");
  });
});

describe("media prefs", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    });
  });

  it("faz round-trip das preferências escolhidas na antessala", () => {
    writeMediaPrefs({ cameraId: "cam-1", micId: "mic-1", camEnabled: false, micEnabled: true });
    expect(readMediaPrefs()).toEqual({
      cameraId: "cam-1",
      micId: "mic-1",
      camEnabled: false,
      micEnabled: true,
    });
  });

  it("recupera de dados corrompidos", () => {
    window.localStorage.setItem("mm.live.media-prefs", "{not json");
    expect(readMediaPrefs()).toEqual(defaultMediaPrefs);
  });

  it("assume câmara/micro ligados quando faltam campos", () => {
    window.localStorage.setItem("mm.live.media-prefs", JSON.stringify({ cameraId: 5 }));
    expect(readMediaPrefs()).toEqual({
      cameraId: undefined,
      micId: undefined,
      camEnabled: true,
      micEnabled: true,
    });
  });
});
