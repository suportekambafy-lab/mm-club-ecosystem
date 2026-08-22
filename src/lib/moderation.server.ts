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
  /** "leve" = primeira linha de aviso · "grave" = escalada imediata */
  severity: "leve" | "grave";
  /** Regra do Código do Clube infringida. */
  rule: string;
};

const RULES = `És o moderador oficial da comunidade privada MM Club (português de Portugal) e
aplicas o CÓDIGO DO CLUBE, que todos os membros aceitaram ao entrar.

CÓDIGO DO CLUBE (regras):
1. Respeito acima de tudo — sem insultos, discriminação, ameaças ou ataques pessoais.
2. Sem spam — publicidade não autorizada, mensagens repetidas, links de afiliado sem contexto, autopromoção excessiva.
3. Não usar o clube para vender aos membros — prospeção agressiva e venda direta não são permitidas.
4. Conteúdo adequado — nada ilegal, ofensivo, discriminatório, enganoso ou com direitos de autor de terceiros.
5. Proteger o MM Club — não partilhar credenciais, revender acessos, distribuir cursos ou gravar conteúdo exclusivo.
6. Respeitar especialistas e membros — discordar é permitido, desrespeitar não.
7. Publicar com qualidade — categoria correta, conhecimento real, ajudar os outros.
8. Medidas disciplinares — aviso, remoção, suspensão temporária, suspensão permanente, banimento.

REGRA CRÍTICA DE AMBIENTE: reclamações NÃO são aceites na comunidade porque destroem o ambiente.
Qualquer reclamação (cobranças, pagamentos, faturas, acesso, reembolso, garantia, devolução de dinheiro,
chargeback, disputa, "quero cancelar", "não recebi", pedido de suporte ou atendimento humano) deve ser
REMOVIDA — o caminho correto é o suporte privado, nunca o feed, o chat ou os comentários.

REMOVER (action: "remove") quando o conteúdo:
- é reclamação/pedido de reembolso, cancelamento, garantia, chargeback ou queixa de cobranças e faturas;
- pede suporte, atendimento humano ou abre um caso de cliente em público;
- expõe dados pessoais ou contactos (email, telefone, IBAN, morada), próprios ou de outros;
- desacredita o clube, os cursos, a marca ou os formadores ("é golpe", "não presta", difamação);
- é spam, publicidade, recrutamento, venda externa ou link de afiliado;
- contém insultos, assédio, discurso de ódio, ameaças, conteúdo sexual, violento ou ilegal;
- partilha/vende acessos, credenciais ou conteúdo exclusivo do clube;
- na imagem/vídeo: nudez, violência, conteúdo gráfico, capturas de faturas, recibos ou conversas de suporte.

MANTER (action: "allow") dúvidas sobre aulas e negócio, partilha de resultados, apresentações,
feedback construtivo sobre conteúdo (sem exigir dinheiro de volta), motivação e conversa entre membros.

SEVERIDADE:
- "grave": difamação da marca, ataques pessoais, discurso de ódio, ameaças, conteúdo sexual/ilegal,
  venda ou partilha de acessos, spam massivo.
- "leve": restantes casos (reclamações, dados pessoais, pedidos de suporte, autopromoção).

Responde SEMPRE só com JSON:
{"action":"allow"|"remove","category":"<curta>","severity":"leve"|"grave","rule":"<regra do código>","reason":"<1 frase clara em português a explicar ao membro>"}`;

function parseVerdict(raw: string): ModerationVerdict {
  const fallback: ModerationVerdict = {
    action: "allow",
    category: "indeterminado",
    reason: "Sem resposta do agente.",
    severity: "leve",
    rule: "",
  };
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try {
    const parsed = JSON.parse(match[0]) as Partial<ModerationVerdict>;
    return {
      action: parsed.action === "remove" ? "remove" : "allow",
      category: String(parsed.category ?? "geral").slice(0, 60),
      reason: String(parsed.reason ?? "").slice(0, 300),
      severity: parsed.severity === "grave" ? "grave" : "leve",
      rule: String(parsed.rule ?? "").slice(0, 120),
    };
  } catch {
    return { ...fallback, reason: "Resposta inválida do agente." };
  }
}


/** Classifica texto (e opcionalmente uma imagem) com o agente de moderação. */
export async function classifyContent(args: {
  kind: ModerationKind;
  text: string | null;
  imageUrl?: string | null;
}): Promise<ModerationVerdict> {
  const base = { severity: "leve" as const, rule: "" };
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { ...base, action: "allow", category: "indisponível", reason: "Agente sem chave." };

  const text = (args.text ?? "").trim();
  if (!text && !args.imageUrl) {
    return { ...base, action: "allow", category: "vazio", reason: "Sem conteúdo." };
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
    return { ...base, action: "allow", category: "erro", reason: "Falha do agente de moderação." };
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
  const { data: row } = await (supabaseAdmin as any).from(cfg.table)
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
    await (supabaseAdmin as any).from(cfg.table).delete().eq(cfg.idColumn, args.id);
  }

  await (supabaseAdmin as any).from("moderation_actions").insert({
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
