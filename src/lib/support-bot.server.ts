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
- Não é uma pergunta (apresentação, celebração, opinião, partilha de resultados).
- Precisa de informação que não tens (dados pessoais do membro, decisões da equipa).
- Já existe resposta útil de outro membro no post.

Formato da resposta: apenas o texto do comentário, ou a palavra SKIP.`;

type PostRow = {
  id: string;
  content: string | null;
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
    .select("id, content, author_id, author:profiles!community_posts_author_id_fkey (display_name)")
    .eq("id", postId)
    .maybeSingle();

  const row = post as PostRow | null;
  if (!row) return { replied: false };
  if (row.author_id === SUPPORT_BOT_ID) return { replied: false };

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
      model: gateway("google/gemini-3.5-flash"),
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
