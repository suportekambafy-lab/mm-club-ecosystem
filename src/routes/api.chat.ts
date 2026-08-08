import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

type ChatRequestBody = { messages?: unknown; threadId?: unknown };

/** Guarda mensagens da conversa (thread) do membro, se houver thread. */
async function persistMessages(
  threadId: string,
  userId: string,
  messages: UIMessage[],
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as { from: (t: string) => any };

    const { data: thread } = await admin
      .from("ai_threads")
      .select("id, title, user_id")
      .eq("id", threadId)
      .maybeSingle();
    if (!thread || thread.user_id !== userId) return;

    const rows = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        thread_id: threadId,
        user_id: userId,
        client_id: m.id,
        role: m.role,
        parts: (m.parts ?? []).filter((p: { type: string }) => p.type === "text"),
      }))
      .filter((r) => r.parts.length > 0);

    if (rows.length > 0) {
      const { error: upsertError } = await admin
        .from("ai_messages")
        .upsert(rows, { onConflict: "thread_id,client_id" });
      if (upsertError) console.error("[api.chat] upsert messages failed", upsertError);
    }


    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (!thread.title || thread.title === "Nova conversa") {
      const firstUser = messages.find((m) => m.role === "user");
      const text = firstUser ? extractLastUserText([firstUser]) : "";
      if (text) patch.title = text.replace(/\s+/g, " ").slice(0, 60);
    }
    await admin.from("ai_threads").update(patch).eq("id", threadId);
  } catch (err) {
    console.error("[api.chat] persistMessages failed", err);
  }
}


const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

const BASE_SYSTEM = `És o MM Inteligence, o assistente do MM Club (Marca Milionária) — uma plataforma de formação e comunidade sobre marca pessoal, marketing, vendas, COD/dropshipping, social media e escala de negócio.

Como falas:
- Português europeu (Portugal), tom humano, próximo e directo — como um mentor que conhece bem o aluno. Trata por "tu".
- Conversa natural: frases curtas, sem burocracia, sem "Como assistente de IA...". Não repitas a pergunta do utilizador.
- Não despejes listas gigantes por defeito. Responde ao que foi perguntado, e só depois oferece ir mais fundo ("Queres que detalhe a parte X?").
- Markdown leve (negrito, listas curtas) só quando ajuda mesmo a ler.
- Mantém o fio da conversa: usa o que já foi dito antes em vez de recomeçar.

Botões de resposta rápida:
- Sempre que fizeres uma pergunta com opções fechadas (escolher curso, módulo, objetivo, sim/não, etc.), mantém a pergunta em UMA frase curta e escreve as opções no fim da mensagem no formato [[Opção]], uma por linha, no máximo 5.
- Exemplo: "Boas! De que curso estás a falar?" e depois as opções em [[ ]].
- Não numeres nem repitas as opções em texto normal — o formato [[ ]] já as transforma em botões clicáveis.
- Nunca uses [[ ]] para outra coisa, e nunca em respostas que não sejam perguntas de escolha.

Regra crítica — desambiguação:
- A Academia tem VÁRIOS cursos. Se a pergunta usar referências ambíguas ("a aula 5", "o módulo 2", "aquela aula do início") sem indicar o curso, NÃO adivinhes: faz uma pergunta curta a perguntar de que curso se trata, oferecendo os cursos como opções numeradas. Uma pergunta, não um interrogatório.
- Se o histórico da conversa já deixar claro o curso, continua sem perguntar.
- Se a pergunta for conceptual (não sobre uma aula específica), responde logo — não peças esclarecimentos desnecessários.

O que fazes:
- Ajudas em tudo o que o membro precise: dúvidas de conteúdo das aulas, próximos passos, estratégia, copy, oferta, tráfego, produto, mentalidade, organização e uso da própria plataforma (Academia, Comunidade, Lives, Ferramentas/MM Studio, subscrição).
- Quando falares de uma aula, refere o curso + título da aula e, se útil, o link interno no formato /academia/<courseId>/<lessonId>.
- Quando ajudar, termina com um próximo passo concreto (uma acção, não cinco).
- Se o membro estiver preso ou frustrado, reconhece isso em uma linha antes de resolver.
- Não inventes aulas, eventos, links, preços, nomes ou dados. Se não souberes, di-lo em uma linha e sugere onde confirmar (ex.: suporte, admin).

Catálogo real da Academia (usa para desambiguar e para localizar aulas; a numeração é sequencial dentro do curso):

`;


async function buildKnowledgeContext(query: string, apiKey: string): Promise<string> {
  try {
    const embRes = await fetch(`${GATEWAY}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: query }),
    });
    if (!embRes.ok) return "";
    const embJson = (await embRes.json()) as { data: Array<{ embedding: number[] }> };
    const emb = embJson.data[0]?.embedding;
    if (!emb) return "";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: matches } = await supabaseAdmin.rpc("match_lesson_chunks", {
      query_embedding: emb as unknown as string,
      match_count: 8,
      min_similarity: 0.3,
    });
    if (!Array.isArray(matches) || matches.length === 0) return "";

    const blocks = matches
      .map((m: any, i: number) => {
        const label = [m.course_title, m.lesson_title].filter(Boolean).join(" · ") || "Aula";
        return `[${i + 1}] ${label}\n${m.content}`;
      })
      .join("\n\n");
    return `\n\nContexto de aulas MM Club relevantes para a pergunta (usa quando fizer sentido, cita a aula pelo nome):\n\n${blocks}`;
  } catch {
    return "";
  }
}

function extractRecentUserText(messages: UIMessage[], take = 3): string {
  const texts: string[] = [];
  for (let i = messages.length - 1; i >= 0 && texts.length < take; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const parts = (m as any).parts as Array<{ type: string; text?: string }> | undefined;
    const text = parts?.length
      ? parts.filter((p) => p.type === "text" && p.text).map((p) => p.text as string).join(" ")
      : typeof (m as any).content === "string"
        ? ((m as any).content as string)
        : "";
    if (text.trim()) texts.unshift(text.trim());
  }
  return texts.join("\n");
}

function extractLastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const parts = (m as any).parts as Array<{ type: string; text?: string }> | undefined;
    if (parts?.length) {
      const text = parts
        .filter((p) => p.type === "text" && p.text)
        .map((p) => p.text as string)
        .join(" ");
      if (text.trim()) return text.trim();
    }
    const content = (m as any).content;
    if (typeof content === "string" && content.trim()) return content.trim();
  }
  return "";
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireRequestUser } = await import("@/lib/api-auth.server");
        const auth = await requireRequestUser(request);
        if ("denied" in auth) return auth.denied;

        const { messages, threadId } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }
        const thread = typeof threadId === "string" && threadId ? threadId : null;

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const lastUser = extractLastUserText(messages as UIMessage[]);
        const retrievalQuery = extractRecentUserText(messages as UIMessage[]) || lastUser;
        const context = retrievalQuery ? await buildKnowledgeContext(retrievalQuery, key) : "";
        const { buildCatalogOutline, detectAmbiguousLessonReference, loadEffectiveCourses } =
          await import("@/lib/jade-catalog.server");
        const catalog = await loadEffectiveCourses();
        const ambiguous = detectAmbiguousLessonReference(lastUser, retrievalQuery, catalog);
        const disambiguation = ambiguous
          ? `\n\nINSTRUÇÃO OBRIGATÓRIA PARA ESTA RESPOSTA: o membro referiu uma aula/módulo por número sem dizer o curso, e existem vários cursos. NÃO respondas ao conteúdo e NÃO uses o contexto de aulas abaixo. Responde APENAS com uma frase curta e natural a perguntar de que curso se trata, seguida das opções em botões, uma por linha, exactamente neste formato:\n${ambiguous}`
          : "";
        const system = BASE_SYSTEM + buildCatalogOutline(catalog) + context + disambiguation;

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3.5-flash");

        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
          onFinish: async ({ messages: finalMessages }) => {
            if (!thread) return;
            await persistMessages(thread, auth.user.id, finalMessages as UIMessage[]);
          },
        });

      },
    },
  },
});

