import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

type ChatRequestBody = { messages?: unknown };

const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

const BASE_SYSTEM = `És o Suporte IA do MM Club (Marca Milionária), a plataforma de formação e comunidade fundada por especialistas em marca pessoal, marketing e escala de negócio.

O teu papel:
- Ajudar membros com dúvidas sobre marca pessoal, posicionamento, marketing, vendas, escala e liderança.
- Dar respostas objetivas, práticas e acionáveis. Evita preencher com fluff.
- Escreve em português europeu (Portugal), tom próximo, direto e profissional.
- Usa markdown quando ajuda (listas, negrito, títulos curtos).
- Quando o contexto de aulas transcritas abaixo for relevante, cita a aula (curso e título) e integra a explicação com naturalidade.
- Se o contexto não cobrir a pergunta, responde com o teu conhecimento geral sobre marca e negócio — não digas que não tens contexto.
- Não inventes cursos, aulas, eventos, links, preços ou nomes de pessoas que não te forem dados.`;

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
      match_count: 6,
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
        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const lastUser = extractLastUserText(messages as UIMessage[]);
        const context = lastUser ? await buildKnowledgeContext(lastUser, key) : "";
        const system = BASE_SYSTEM + context;

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3.5-flash");

        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});

