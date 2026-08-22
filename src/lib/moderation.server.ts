/**
 * MM Club — Agente de moderação (server-only).
 *
 * Classifica conteúdo da comunidade (posts, comentários, chat, shorts) com o
 * Lovable AI Gateway e remove imediatamente o que viola as regras do clube.
 * Cada acção fica registada em `moderation_actions` para auditoria no admin.
 */
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export type ModerationKind =
  | "community_post"
  | "community_comment"
  | "community_chat"
  | "short"
  | "short_comment"
  | "live_chat";

export type ModerationVerdict = {
  action: "allow" | "remove";
  category: string;
  reason: string;
};

const RULES = `És o moderador oficial da comunidade privada MM Club (português de Portugal).
Decides se uma mensagem/publicação deve ser REMOVIDA imediatamente.

REMOVER (action: "remove") quando o conteúdo:
- pede reembolso, devolução de dinheiro, cancelamento, "garantia", chargeback ou disputa de pagamento;
- reclama publicamente de cobranças, pagamentos, faturas ou acesso pago;
- expõe dados pessoais/contactos (email, telefone, IBAN, morada) próprios ou de outros;
- pede suporte privado, atendimento humano ou tenta abrir um caso de cliente no feed público;
- desacredita o curso, a plataforma, a marca ou os formadores (difamação, "é golpe", "não presta");
- é spam, publicidade, recrutamento, venda de produtos/serviços externos ou divulgação de links de afiliado;
- contém insultos, assédio, discurso de ódio, ameaças, conteúdo sexual, violento ou ilegal;
- na imagem/vídeo: nudez, violência, conteúdo gráfico, capturas de ecrã de faturas/recibos/conversas de suporte.

MANTER (action: "allow") dúvidas normais sobre aulas e negócio, partilha de resultados,
apresentações, feedback construtivo sobre conteúdo (sem pedir dinheiro de volta),
motivação e conversa entre membros.

Responde SEMPRE só com JSON: {"action":"allow"|"remove","category":"<curta>","reason":"<1 frase em português>"}`;

function parseVerdict(raw: string): ModerationVerdict {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { action: "allow", category: "indeterminado", reason: "Sem resposta do agente." };
  try {
    const parsed = JSON.parse(match[0]) as Partial<ModerationVerdict>;
    return {
      action: parsed.action === "remove" ? "remove" : "allow",
      category: String(parsed.category ?? "geral").slice(0, 60),
      reason: String(parsed.reason ?? "").slice(0, 300),
    };
  } catch {
    return { action: "allow", category: "indeterminado", reason: "Resposta inválida do agente." };
  }
}

/** Classifica texto (e opcionalmente uma imagem) com o agente de moderação. */
export async function classifyContent(args: {
  kind: ModerationKind;
  text: string | null;
  imageUrl?: string | null;
}): Promise<ModerationVerdict> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { action: "allow", category: "indisponível", reason: "Agente sem chave." };

  const text = (args.text ?? "").trim();
  if (!text && !args.imageUrl) {
    return { action: "allow", category: "vazio", reason: "Sem conteúdo." };
  }

  const gateway = createLovableAiGatewayProvider(key);
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: `Tipo: ${args.kind}\nConteúdo:\n${text || "(sem texto)"}` },
  ];
  if (args.imageUrl && /^https:\/\//i.test(args.imageUrl)) {
    content.push({ type: "image", image: new URL(args.imageUrl) });
  }

  try {
    const result = await generateText({
      model: gateway("google/gemini-3.7-flash"),
      system: RULES,
      messages: [{ role: "user", content: content as never }],
    });
    return parseVerdict(result.text ?? "");
  } catch (err) {
    console.error("[moderation] classify failed", err);
    return { action: "allow", category: "erro", reason: "Falha do agente de moderação." };
  }
}

type TargetConfig = {
  table: string;
  idColumn: string;
  textColumn: string | null;
  imageColumn: string | null;
  authorColumn: string;
};

const TARGETS: Record<ModerationKind, TargetConfig> = {
  community_post: {
    table: "community_posts",
    idColumn: "id",
    textColumn: "content",
    imageColumn: "image_url",
    authorColumn: "author_id",
  },
  community_comment: {
    table: "community_comments",
    idColumn: "id",
    textColumn: "content",
    imageColumn: null,
    authorColumn: "author_id",
  },
  community_chat: {
    table: "community_chat_messages",
    idColumn: "id",
    textColumn: "content",
    imageColumn: null,
    authorColumn: "author_id",
  },
  short: {
    table: "mm_shorts",
    idColumn: "id",
    textColumn: "caption",
    imageColumn: "thumbnail_url",
    authorColumn: "author_id",
  },
  short_comment: {
    table: "mm_short_comments",
    idColumn: "id",
    textColumn: "body",
    imageColumn: null,
    authorColumn: "user_id",
  },
  live_chat: {
    table: "live_chat_messages",
    idColumn: "id",
    textColumn: "body",
    imageColumn: null,
    authorColumn: "user_id",
  },
};

/**
 * Analisa um item e remove-o de imediato se violar as regras.
 * Idempotente: se o item já não existir, devolve `removed: false`.
 */
export async function moderateTarget(args: {
  kind: ModerationKind;
  id: string;
}): Promise<{ removed: boolean; category: string; reason: string }> {
  const cfg = TARGETS[args.kind];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const columns = [cfg.idColumn, cfg.authorColumn, cfg.textColumn, cfg.imageColumn]
    .filter(Boolean)
    .join(",");
  const { data: row } = await (supabaseAdmin.from(cfg.table) as any)
    .select(columns)
    .eq(cfg.idColumn, args.id)
    .maybeSingle();
  if (!row) return { removed: false, category: "inexistente", reason: "Conteúdo já removido." };

  const verdict = await classifyContent({
    kind: args.kind,
    text: cfg.textColumn ? ((row as any)[cfg.textColumn] as string | null) : null,
    imageUrl: cfg.imageColumn ? ((row as any)[cfg.imageColumn] as string | null) : null,
  });

  const excerpt = String(
    (cfg.textColumn ? (row as any)[cfg.textColumn] : "") ?? "",
  ).slice(0, 500);

  if (verdict.action === "remove") {
    await (supabaseAdmin.from(cfg.table) as any).delete().eq(cfg.idColumn, args.id);
  }

  await (supabaseAdmin.from("moderation_actions") as any).insert({
    kind: args.kind,
    target_id: args.id,
    author_id: (row as any)[cfg.authorColumn] ?? null,
    action: verdict.action,
    category: verdict.category,
    reason: verdict.reason,
    excerpt,
  });

  return { removed: verdict.action === "remove", category: verdict.category, reason: verdict.reason };
}
