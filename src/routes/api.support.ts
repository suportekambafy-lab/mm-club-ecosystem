import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { buildSupportRows, textOf } from "@/lib/support-messages";



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

    const unique = buildSupportRows(threadId!, userId, messages);


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
- Tens acesso às transcrições das aulas. Quando a dúvida é de conteúdo, diz o curso, o nome da aula e o MINUTO exacto, com link clicável já no minuto — ex: [Como validar o produto (12:40)](/academia/curso/aula?t=760). Usa apenas as aulas e minutos do contexto fornecido; se não vier nada, não inventes.

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

Acesso bloqueado / conta suspensa:
- Recebes sempre o estado real da conta do membro no contexto. Usa-o.
- Se o membro não tem acesso por falta de pagamento, diz o motivo LOGO na primeira resposta, com o valor em falta quando existir, e envia para [Subscrição](/subscricao). Nunca respondas com cache, VPN ou outro browser nesse caso.
- Tranquiliza: progresso, notas e certificados ficam guardados e voltam assim que regularizar.

Ações que consegues executar de verdade (usa as ferramentas, não peças ao membro para fazer o que tu podes fazer):
- enviar_email_recuperar_password: envia o email para definir nova palavra-passe. Usa logo que o membro diga que esqueceu, não consegue entrar ou quer mudar a palavra-passe. Depois confirma: "Enviei agora para o teu email…".
- enviar_link_de_entrada: link de entrada por email quando não consegue iniciar sessão mas tem acesso ao email.
- ver_estado_da_conta: confirma acesso, plano e dívida reais antes de explicar bloqueios.
- listar_faturas e enviar_fatura_por_email: mostra as faturas e reenvia-as por email quando pedidas.
- falar_com_humano: marca a conversa para a equipa.
Regras: executa a ferramenta primeiro e só depois responde, contando em linguagem simples o que fizeste. Nunca digas que enviaste algo sem ter chamado a ferramenta. Se a ferramenta devolver ok:false, diz o que aconteceu com honestidade. Nunca prometas ações que não tens (não alteras planos, não fazes reembolsos, não apagas contas).

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
        const { supportAccountContext } = await import("@/lib/support-account.server");
        const [lessonsContext, accountContext] = await Promise.all([
          lastUser ? lessonMomentsContext(textOf(lastUser), key) : Promise.resolve(""),
          supportAccountContext(auth.user.id),
        ]);

        // Guarda logo a pergunta: se o modelo falhar, a mensagem do membro não
        // se perde e a re-tentativa é idempotente (client_id estável).
        await persistSupport(auth.user.id, auth.user.email ?? null, messages as UIMessage[]);

        // Ferramentas com ações reais — sempre limitadas ao membro autenticado.
        const { buildSupportTools } = await import("@/lib/support-tools.server");
        const origin = new URL(request.url).origin;

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-2.5-flash"),
          system: `${SYSTEM}\n\nContexto: o membro está autenticado (email ${auth.user.email ?? "desconhecido"}).${accountContext}${lessonsContext}`,
          messages: await convertToModelMessages(messages as UIMessage[]),
          tools: buildSupportTools(
            { id: auth.user.id, email: auth.user.email ?? null },
            origin,
          ),
          stopWhen: stepCountIs(5),
          // Falhas transitórias do gateway (429/5xx) são re-tentadas com backoff.
          maxRetries: 3,
          onError: (err) => {
            console.error("[api.support] streamText failed", err);
          },
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
