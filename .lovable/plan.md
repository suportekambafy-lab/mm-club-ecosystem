# Emails diferentes para contas suspensas

Quem está com conta suspensa continua a receber os emails do clube (lives, aulas novas, replays, comunidade, shorts), mas numa versão diferente: com um aviso claro de que o acesso está bloqueado e um botão para regularizar o pagamento.

## Como fica

Para membros suspensos / com dívida, cada email passa a ter:

- Uma faixa amarela no topo: "A tua conta está suspensa — regulariza o pagamento para voltar a ver".
- O conteúdo normal mantém-se (título da live, data, capa, nome da aula), para criar desejo de voltar.
- O botão principal muda: em vez de "Ver detalhes da live" / "Assistir agora", passa a "Regularizar pagamento e assistir", que leva à página de subscrição.
- Uma linha final a garantir que o progresso e certificados ficam guardados.

Quem está ativo, em trial ou em período de tolerância recebe o email exatamente como hoje.

## O que conta como suspenso

Sem acesso válido às aulas e com a subscrição em estado suspenso, expirado, cancelado sem acesso ou em atraso. Membros em trial ou em tolerância não entram nesta versão.

## Detalhes técnicos

1. Novo helper `src/lib/billing/lapsed-recipients.server.ts`:
   - `lapsedUserIds(): Promise<Set<string>>` — cruza `billing_subscriptions` (status `suspended`, `expired`, `cancelled`, `past_due`) com `has_feature(user, 'academy.access')` / `entitlement_grants` para excluir quem ainda tem acesso válido.
   - Uma leitura por difusão (não por destinatário), para não pesar nos envios em massa.

2. `src/lib/email.server.ts`:
   - Bloco reutilizável `lockedNotice()` (faixa amarela) e `lockedCta()` (botão para `${APP_URL}/subscricao`).
   - Parâmetro opcional `locked?: boolean` nos templates `liveAnnouncement`, `liveRescheduled`, `newLesson`, `replayReady`, `communityPost`, `shortPublished`. Quando `locked`, injeta a faixa, troca o CTA e ajusta o texto de fecho.
   - Assunto mantém-se igual (para não parecer email de cobrança), com sufixo discreto apenas onde faz sentido no corpo.

3. Pontos de envio a atualizar, todos a obter o `Set` uma vez antes do ciclo e a passar `locked: lapsed.has(userId)`:
   - `src/lib/lives.functions.ts` (anúncio de live agendada)
   - `src/lib/live-start-email.server.ts` (live começou)
   - `src/routes/api/public/hooks/lives-announce-catchup.ts`
   - `src/lib/broadcasts.functions.ts` (nova aula)
   - `src/lib/community-email.server.ts` (posts da comunidade)
   - `src/lib/shorts-email.server.ts` (shorts)

4. Sem alterações de base de dados; a chave de deduplicação (`kind` + `ref`) mantém-se, portanto ninguém recebe duas versões do mesmo email.

5. Verificação: typecheck e um envio de teste através do fluxo de live de teste, comparando a versão normal com a versão bloqueada.
