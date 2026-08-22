import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { buildSupportRows, sortSupportTimeline } from "./support-messages";

function msg(role: "user" | "assistant", text: string, id?: string): UIMessage {
  return { id: id ?? "", role, parts: [{ type: "text", text }] } as unknown as UIMessage;
}

/** Simula o upsert com chave (thread_id, client_id) do Postgres. */
function upsert(
  store: Map<string, { client_id: string; content: string; created_at: string; seq: number }>,
  rows: ReturnType<typeof buildSupportRows>,
  now: string,
) {
  for (const row of rows) {
    const existing = store.get(row.client_id);
    store.set(row.client_id, {
      client_id: row.client_id,
      content: row.content,
      // created_at só é definido na primeira inserção (default now()).
      created_at: existing?.created_at ?? now,
      seq: row.seq,
    });
  }
}

describe("buildSupportRows", () => {
  it("dá client_id distinto a respostas diferentes sem id do cliente", () => {
    const rows = buildSupportRows("t1", "u1", [
      msg("user", "Não consigo entrar na minha conta"),
      msg("assistant", "Usa a opção recuperar palavra-passe."),
      msg("user", "Como entro nas lives?"),
      msg("assistant", "As lives estão em /lives."),
    ]);

    expect(rows).toHaveLength(4);
    expect(new Set(rows.map((r) => r.client_id)).size).toBe(4);
    expect(rows.map((r) => r.seq)).toEqual([0, 1, 2, 3]);
  });

  it("mantém o id do cliente quando existe", () => {
    const rows = buildSupportRows("t1", "u1", [msg("user", "Olá", "abc123")]);
    expect(rows[0]!.client_id).toBe("abc123");
  });

  it("remove o marcador de escalonamento e mensagens vazias", () => {
    const rows = buildSupportRows("t1", "u1", [
      msg("assistant", "Passo para a equipa. [[HUMANO]]"),
      msg("user", "   "),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.content).toBe("Passo para a equipa.");
  });

  it("nunca sobrescreve mensagens anteriores em envios incrementais", () => {
    const store = new Map<
      string,
      { client_id: string; content: string; created_at: string; seq: number }
    >();

    const turn1 = [
      msg("user", "Não consigo entrar na minha conta"),
      msg("assistant", "Usa a opção recuperar palavra-passe."),
    ];
    upsert(store, buildSupportRows("t1", "u1", turn1), "2026-08-22T15:06:04Z");

    const turn2 = [
      ...turn1,
      msg("user", "Como entro nas lives?"),
      msg("assistant", "As lives estão em /lives."),
    ];
    upsert(store, buildSupportRows("t1", "u1", turn2), "2026-08-22T15:06:25Z");

    const timeline = sortSupportTimeline([...store.values()]);
    expect(timeline.map((r) => r.content)).toEqual([
      "Não consigo entrar na minha conta",
      "Usa a opção recuperar palavra-passe.",
      "Como entro nas lives?",
      "As lives estão em /lives.",
    ]);
  });

  it("reenviar o mesmo histórico é idempotente", () => {
    const store = new Map<
      string,
      { client_id: string; content: string; created_at: string; seq: number }
    >();
    const history = [msg("user", "Olá"), msg("assistant", "Olá! Como ajudo?")];

    upsert(store, buildSupportRows("t1", "u1", history), "2026-08-22T15:00:00Z");
    upsert(store, buildSupportRows("t1", "u1", history), "2026-08-22T15:10:00Z");

    expect(store.size).toBe(2);
    expect([...store.values()].every((r) => r.created_at === "2026-08-22T15:00:00Z")).toBe(true);
  });
});

describe("sortSupportTimeline", () => {
  it("desempata por sequência quando o timestamp é igual", () => {
    const rows = [
      { created_at: "2026-08-22T15:06:04Z", seq: 1, content: "resposta" },
      { created_at: "2026-08-22T15:06:04Z", seq: 0, content: "pergunta" },
      { created_at: "2026-08-22T15:06:25Z", seq: 2, content: "seguimento" },
    ];
    expect(sortSupportTimeline(rows).map((r) => r.content)).toEqual([
      "pergunta",
      "resposta",
      "seguimento",
    ]);
  });

  it("trata seq ausente como zero e não muta o array original", () => {
    const rows = [
      { created_at: "2026-08-22T15:00:01Z", seq: null, content: "b" },
      { created_at: "2026-08-22T15:00:00Z", content: "a" },
    ];
    const sorted = sortSupportTimeline(rows);
    expect(sorted.map((r) => r.content)).toEqual(["a", "b"]);
    expect(rows[0]!.content).toBe("b");
  });
});
