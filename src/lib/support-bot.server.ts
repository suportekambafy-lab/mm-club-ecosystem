/**
 * MM Suporte na Comunidade (server-only).
 *
 * Lê um post da comunidade e, quando é uma dúvida simples que pode ser
 * resolvida com informação da plataforma, publica um comentário em nome do
 * perfil oficial "MM Suporte" (verificado, sem login).
 *
 * Nunca responde a temas de dinheiro/conta (esses vão para o suporte humano),
 * nem a posts que já tenham resposta do agente.
 */
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { SUPPORT_BOT_ID } from "./support-bot";

const SYSTEM = `És o MM Suporte, o agente oficial do MM Club (Marca Milionária), a responder
publicamente na comunidade privada do clube.

Como respondes:
- Português europeu (Portugal), tom humano, calmo e directo. Trata por "tu".
- CURTO: 2 a 4 linhas. Sem saudações longas, sem assinatura.
- Quando indicares uma página da plataforma usa link markdown clicável, ex: [Subscrição](/subscricao), [Academia](/academia), [Ferramentas](/ferramentas).
- Nunca inventes preços, prazos, políticas ou dados da conta do membro.
- Se a resposta estiver numa aula, indica o curso, o nome da aula e o MINUTO exacto, com link markdown clicável já com o minuto — ex: [Como validar o produto (12:40)](/academia/curso/aula?t=760). Usa só aulas e minutos que te são dados no contexto; nunca inventes.
- Nunca menciones ferramentas externas que não conheces com certeza; se o tema é de um serviço externo (ex: verificação de fornecedor/loja), dá orientação prática e genérica: normalmente o membro pode continuar a preparar o resto enquanto espera.

Posts sociais (bom dia, boa semana, apresentações, celebrações, resultados, marcos):
- Responde também a estes, de forma curta (1 a 2 linhas), calorosa e genuína, em nome do clube.
- Ex: desejar boa semana e boas vendas, dar os parabéns pelo resultado, dar as boas-vindas a quem se apresenta.
- Sem emojis a mais (no máximo um), sem venda, sem links forçados. Só sugere uma página se encaixar naturalmente.
- Não inventes dados nem comentes números que não vês.

Conhecimento da plataforma:
- Academia (/academia): cursos e aulas em vídeo, progresso, retomar, pesquisa (/academia/pesquisa).
- Comunidade (/comunidade) e Código do Clube (/codigo).
- Lives (/lives): aulas ao vivo, sala interativa e gravações.
- MM Shorts (/shorts). Ferramentas (/ferramentas): MM Studio, Product Lab, Thumbnails, Links.
- MM Inteligence (/jade): assistente de conteúdo e estratégia.
- Subscrição (/subscricao): plano, próximo débito, método de pagamento, faturas, cancelar.
- Conta: /perfil, palavra-passe em /reset-password, notificações no sino.

Quando NÃO deves responder — devolve exactamente SKIP:
- Envolve dinheiro, cobranças, reembolsos, faturas, cancelamentos ou dados da conta.
- Reclamação, conflito, denúncia ou desabafo.
- Precisa de informação que não tens (dados pessoais do membro, decisões da equipa).
- Já existe resposta útil de outro membro no post.

Regra de ouro: em dúvidas, só respondes quando tens a certeza da resposta com a
informação que tens (plataforma + aulas do contexto). Se não sabes, se tens de
adivinhar ou se a resposta depende de algo que não vês, devolve SKIP e fica em
branco. Uma resposta errada é pior do que nenhuma. Em posts sociais responde
sempre com uma mensagem simpática e breve.

Formato da resposta: apenas o texto do comentário, ou a palavra SKIP.`;

type PostRow = {
  id: string;
  content: string | null;
  created_at?: string | null;
  author_id: string;
  author?: { display_name: string | null } | null;
};

/**
 * Gera e publica (se fizer sentido) a resposta do MM Suporte a um post.
 * Devolve `{ replied: boolean }`.
 */
export async function replyToCommunityPost(postId: string): Promise<{ replied: boolean }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { replied: false };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as { from: (t: string) => any };

  const { data: post } = await admin
    .from("community_posts")
    .select("id, content, created_at, author_id, author:profiles!community_posts_author_id_fkey (display_name)")
    .eq("id", postId)
    .maybeSingle();

  const row = post as PostRow | null;
  if (!row) return { replied: false };
  if (row.author_id === SUPPORT_BOT_ID) return { replied: false };

  // Nunca responde no instante da publicação: espera pelo menos 2 minutos para
  // a resposta não parecer automática.
  const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
  if (createdAt && Date.now() - createdAt < 2 * 60 * 1000) return { replied: false };

  const text = (row.content ?? "").trim();
  if (text.length < 8) return { replied: false };

  const { data: existing } = await admin
    .from("community_comments")
    .select("id, author_id, content")
    .eq("post_id", postId)
    .limit(30);

  const comments = (existing ?? []) as Array<{ author_id: string; content: string }>;
  // Nunca responde duas vezes ao mesmo post; em conversas já longas fica de fora.
  if (comments.some((c) => c.author_id === SUPPORT_BOT_ID)) return { replied: false };
  if (comments.length >= 6) return { replied: false };

  const { lessonMomentsContext } = await import("./lesson-moments.server");
  const lessonsContext = await lessonMomentsContext(text, key);

  const gateway = createLovableAiGatewayProvider(key);
  let answer = "";
  try {
    const result = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system: `${SYSTEM}${lessonsContext}`,
      prompt: [
        `Autor: ${row.author?.display_name ?? "Membro"}`,
        `Post: """${text.slice(0, 4000)}"""`,
        comments.length > 0
          ? `Respostas já existentes: ${comments.map((c) => c.content).join(" | ").slice(0, 800)}`
          : "Ainda não tem respostas.",
      ].join("\n\n"),
    });
    answer = (result.text ?? "").trim();
  } catch (e) {
    console.error("[support-bot] gateway failed", e);
    return { replied: false };
  }

  if (!answer || /^skip$/i.test(answer) || answer.toUpperCase().startsWith("SKIP")) {
    return { replied: false };
  }
  if (answer.length > 900) answer = `${answer.slice(0, 880).trim()}…`;

  const { error } = await admin
    .from("community_comments")
    .insert({ post_id: postId, author_id: SUPPORT_BOT_ID, content: answer });
  if (error) {
    console.error("[support-bot] insert failed", error);
    return { replied: false };
  }
  return { replied: true };
}

type ChatRow = {
  id: string;
  content: string | null;
  created_at: string;
  author_id: string;
  author?: { display_name: string | null } | null;
};

/**
 * MM Suporte no chat ao vivo da comunidade.
 *
 * Responde à mensagem indicada com uma nova mensagem no chat (o chat não tem
 * comentários). Só responde se ainda não existir mensagem do agente depois
 * dessa, para nunca duplicar nem "falar sozinho".
 */
export async function replyToCommunityChatMessage(
  messageId: string,
): Promise<{ replied: boolean }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { replied: false };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as { from: (t: string) => any };

  const { data } = await admin
    .from("community_chat_messages")
    .select(
      "id, content, created_at, author_id, author:profiles!community_chat_messages_author_id_fkey (display_name)",
    )
    .eq("id", messageId)
    .maybeSingle();

  const row = data as ChatRow | null;
  if (!row) return { replied: false };
  if (row.author_id === SUPPORT_BOT_ID) return { replied: false };

  const createdAt = new Date(row.created_at).getTime();
  if (Date.now() - createdAt < 2 * 60 * 1000) return { replied: false };

  const text = (row.content ?? "").trim();
  if (text.length < 8) return { replied: false };

  // Contexto: mensagens seguintes. Se já houver resposta do agente ou da
  // equipa depois desta mensagem, fica de fora.
  const { data: after } = await admin
    .from("community_chat_messages")
    .select("author_id, content")
    .gt("created_at", row.created_at)
    .order("created_at", { ascending: true })
    .limit(20);

  const later = (after ?? []) as Array<{ author_id: string; content: string }>;
  if (later.some((m) => m.author_id === SUPPORT_BOT_ID)) return { replied: false };
  if (later.length >= 6) return { replied: false };

  const { lessonMomentsContext } = await import("./lesson-moments.server");
  const lessonsContext = await lessonMomentsContext(text, key);

  const gateway = createLovableAiGatewayProvider(key);
  let answer = "";
  try {
    const result = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system: `${SYSTEM}${lessonsContext}`,
      prompt: [
        "Estás a responder no chat ao vivo do grupo (mensagens curtas, conversa em tempo real).",
        `Autor: ${row.author?.display_name ?? "Membro"}`,
        `Mensagem: """${text.slice(0, 2000)}"""`,
        later.length > 0
          ? `Mensagens seguintes: ${later.map((m) => m.content).join(" | ").slice(0, 800)}`
          : "Ainda ninguém respondeu.",
      ].join("\n\n"),
    });
    answer = (result.text ?? "").trim();
  } catch (e) {
    console.error("[support-bot] chat gateway failed", e);
    return { replied: false };
  }

  if (!answer || /^skip$/i.test(answer) || answer.toUpperCase().startsWith("SKIP")) {
    return { replied: false };
  }
  if (answer.length > 700) answer = `${answer.slice(0, 680).trim()}…`;

  const { error } = await admin
    .from("community_chat_messages")
    .insert({ author_id: SUPPORT_BOT_ID, content: answer });
  if (error) {
    console.error("[support-bot] chat insert failed", error);
    return { replied: false };
  }
  return { replied: true };
}
