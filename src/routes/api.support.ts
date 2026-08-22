import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

function textOf(m: UIMessage): string {
  return (m.parts ?? [])
    .filter((part: { type: string }) => part.type === "text")
    .map((part) => (part as { text?: string }).text ?? "")
    .join("")
    .trim();
}

/** Guarda a conversa de suporte do membro (uma thread por membro). */
async function persistSupport(
  userId: string,
  email: string | null,
  messages: UIMessage[],
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as { from: (t: string) => any };

    const { data: existing } = await admin
      .from("support_threads")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    let threadId = existing?.id as string | undefined;
    if (!threadId) {
      const { data: created, error } = await admin
        .from("support_threads")
        .insert({ user_id: userId, email })
        .select("id")
        .single();
      if (error || !created) return;
      threadId = created.id as string;
    }

    const rows = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m, index) => ({
        thread_id: threadId!,
        user_id: userId,
        client_id: m.id && String(m.id).trim() ? String(m.id) : `${m.role}-${index}`,
        role: m.role,
        content: textOf(m).replace("[[HUMANO]]", "").trim(),
      }))
      .filter((r) => r.content.length > 0);

    const byClient = new Map<string, (typeof rows)[number]>();
    for (const row of rows) byClient.set(row.client_id, row);
    const unique = [...byClient.values()];

    if (unique.length > 0) {
      await admin
        .from("support_messages")
        .upsert(unique, { onConflict: "thread_id,client_id" });
    }

    const escalated = messages.some((m) => m.role === "assistant" && textOf(m).includes("[[HUMANO]]"));
    await admin
      .from("support_threads")
      .update({
        last_message_at: new Date().toISOString(),
        message_count: unique.length,
        email,
        ...(escalated ? { escalated: true, handled: false } : {}),
      })
      .eq("id", threadId);
  } catch (err) {
    console.error("[api.support] persistSupport failed", err);
  }
}

type SupportRequestBody = { messages?: unknown };

const SYSTEM = `És o MM Suporte, o assistente de suporte oficial do MM Club (Marca Milionária).

Como falas:
- Português europeu (Portugal), tom humano, calmo e directo. Trata por "tu".
- Respostas CURTAS: 2 a 5 linhas. Passos numerados só quando são mesmo passos.
- Quando indicares uma página da plataforma, escreve SEMPRE um link markdown clicável com o caminho interno, por exemplo [Subscrição](/subscricao), [Academia](/academia) ou [Perfil](/perfil). Nunca escreves o caminho em texto simples nem em bloco de código — o membro não entende rotas, tem de conseguir clicar e ir directo.
- Nunca inventes preços, prazos, políticas, links ou dados da conta do membro.

O que sabes sobre a plataforma (usa isto para ajudar):
- Academia (/academia): cursos e aulas em vídeo, progresso automático, marcar aula como concluída, retomar de onde parou, pesquisa de aulas (/academia/pesquisa).
- Comunidade (/comunidade): feed e chat, posts, comentários, reações, ranking e badges. Existe o Código do Clube (/codigo) — reclamações sobre pagamentos/reembolsos não são permitidas na Comunidade e devem ir para o suporte.
- Lives (/lives): aulas ao vivo, sala interativa, avisos por email/notificação e gravações (replays) na mesma página.
- MM Shorts (/shorts): vídeos curtos da comunidade.
- Ferramentas (/ferramentas): MM Studio (imagens, vídeos, logótipos, criativos, marca), MM Product Lab, Thumbnails e Links úteis. O MM Studio usa créditos.
- MM Inteligence (/jade): assistente de conteúdo e estratégia (diferente de ti — tu és suporte da plataforma).
- Subscrição (/subscricao): ver plano, próximo débito, actualizar método de pagamento, faturas em PDF, cancelar.
- Conta: perfil em /perfil; recuperar palavra-passe em /reset-password; notificações no sino do topo e push no telemóvel (instalar a app pelo browser).

Resolução típica:
- Vídeo não carrega: recarregar a página, testar noutro browser/rede, desligar VPN/bloqueadores, limpar cache.
- Não recebe emails: verificar spam e o endereço no perfil.
- Pagamento falhado: actualizar o método de pagamento em /subscricao e tentar novamente.

Escalar para humano (WhatsApp):
- Escala quando: envolve dinheiro (cobranças, reembolsos, faturas, cancelamentos com disputa), dados da conta que não podes ver, suspeita de erro/bug da plataforma, o membro já tentou o que sugeriste, o membro pede uma pessoa, ou está claramente frustrado.
- Para escalar: escreve UMA frase a dizer que passas para a equipa humana e termina a mensagem com o marcador exacto [[HUMANO]] na última linha, sozinho.
- Nunca uses [[HUMANO]] quando conseguires resolver com uma instrução simples.
- Nunca prometas prazos de resposta concretos.`;

export const Route = createFileRoute("/api/support")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireRequestUser } = await import("@/lib/api-auth.server");
        const auth = await requireRequestUser(request);
        if ("denied" in auth) return auth.denied;

        const { messages } = (await request.json()) as SupportRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const lastUser = [...(messages as UIMessage[])].reverse().find((m) => m.role === "user");
        const { lessonMomentsContext } = await import("@/lib/lesson-moments.server");
        const lessonsContext = lastUser ? await lessonMomentsContext(textOf(lastUser), key) : "";

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3.5-flash"),
          system: `${SYSTEM}\n\nContexto: o membro está autenticado (email ${auth.user.email ?? "desconhecido"}).${lessonsContext}`,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
          onFinish: async ({ messages: finalMessages }) => {
            await persistSupport(
              auth.user.id,
              auth.user.email ?? null,
              finalMessages as UIMessage[],
            );
          },
        });
      },
    },
  },
});
