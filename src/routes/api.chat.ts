import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

type ChatRequestBody = { messages?: unknown };

const SYSTEM_PROMPT = `És o Suporte IA do MM Club (Marca Milionária), a plataforma de formação e comunidade fundada por especialistas em marca pessoal, marketing e escala de negócio.

O teu papel:
- Ajudar membros com dúvidas sobre marca pessoal, posicionamento, marketing, vendas, escala e liderança.
- Dar respostas objetivas, práticas e acionáveis. Evita preencher com fluff.
- Escreve em português europeu (Portugal), tom próximo, direto e profissional.
- Usa markdown quando ajuda (listas, negrito, títulos curtos).
- Se não souberes algo, admite-o em vez de inventar.
- Não inventes cursos, aulas, eventos, links, preços ou nomes de pessoas que não te forem dados.`;

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

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3.5-flash");

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});
