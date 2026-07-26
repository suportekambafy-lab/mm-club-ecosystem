# MM Club Revenue Recovery Engine (Billing Intelligence v2)

## Ponto de partida (verificado no código)

- A máquina de estados já define exatamente os 7 estados pedidos e as transições válidas (`src/lib/billing/state-machine.ts`).
- Quando uma renovação falha, o motor tenta **uma vez** outro cartão guardado e marca `past_due`. Não existe calendário de tentativas, nem `grace_period`, nem `suspended` aplicados em runtime.
- A tabela `billing_dunning_attempts` existe mas **não é usada por nenhum código** — é o lugar natural para o novo motor.
- A fila (`job_queue`) já suporta agendamento (`run_after`), tentativas e bloqueio, e o `billing-tick` (pg_cron, 5/5 min) já a drena. É a base de execução.
- O gateway já devolve `failureReason` da Mollie, mas hoje esse valor não é guardado nem classificado.

## Princípios do Recovery Engine

O Recovery Engine deve obedecer sempre aos seguintes princípios:

- Nunca efetuar cobranças duplicadas.
- Nunca cobrar uma invoice enquanto existir um pagamento pendente.
- Nunca ultrapassar o limite máximo de tentativas.
- Nunca remover acesso Premium antes do fim do Grace Period.
- Nunca perder histórico de cobrança.
- Todas as decisões devem ser auditáveis através de Timeline, Ledger e Dunning.
- Todas as operações devem ser idempotentes e seguras contra concorrência.
- O sistema deve privilegiar a recuperação da receita antes do cancelamento definitivo da subscrição.

## 1. Registo e classificação da falha

Ao falhar um pagamento: guardar código/mensagem/tipo do gateway, criar Timeline + Ledger + registo de dunning, passar a `past_due` e arrancar o Recovery Engine.

Classificador (`src/lib/billing/recovery/classify.ts`):

- **Recoverable** — saldo insuficiente, timeout, banco indisponível, recusa temporária → calendário completo.
- **Permanent** — cartão expirado/cancelado, método removido, conta encerrada → poucas tentativas, foco em pedir atualização do método (email + aviso in-app).
- **Fraud** — fraude, chargeback, bloqueio → parar recovery e criar alerta administrativo.

## 2. Calendário de tentativas

Jobs `recovery.attempt` na fila, sempre com jitter de ±15%:

| Fase | Tentativas | Estado |
| --- | --- | --- |
| 0–24h | imediato, +4h, +8h, +16h, +24h | past_due |
| Dias 2–15 | 2, 4, 7, 10, 15 | grace_period (Premium mantido) |
| Dia 16 | — | suspended (Premium removido; conta, perfil, histórico, faturas e login mantidos) |
| Dias 21–90 | 21, 28, 35, 45, 60, 75, 90 | suspended, cobrança continua |
| Após 90 dias | fim | cancelled — nada é apagado |

O espaçamento dentro de cada fase é ajustado pelo Recovery Score.

## 3. Cobranças imediatas por evento

Verificação de dívida + tentativa quando: novo método de pagamento, cartão atualizado, login no MM Club, abertura da página de subscrição, mudança de plano (recupera primeiro) e antes de qualquer novo checkout.

## 4. Recovery Score (0–100)

Por fatura, em `src/lib/billing/recovery/score.ts`: motivo da falha, histórico de pagamentos, tempo como membro, pagamentos bem-sucedidos, falhas consecutivas, tempo desde a última tentativa, atualização recente do método, valor da fatura e idade da dívida.

- 80–100: agressivo nos primeiros dias · 40–79: espaçamento maior · 0–39: menos tentativas, foco em atualizar o método.

## 5. Garantias anti-duplicação

- **Pagamento em curso bloqueia tudo**: se existir um pagamento da mesma fatura em `pending`, `authorized` ou qualquer estado intermédio do gateway, o motor **não cria** nova tentativa — reagenda e espera pela resolução.
- **Teto absoluto de 15 tentativas automáticas** por fatura, independentemente do calendário ou de gatilhos por evento. Ao atingir o teto, o motor pára e passa a comunicação manual/admin.
- Uma tentativa em curso por fatura (bloqueio na base de dados), nunca duas cobranças da mesma fatura, nunca novo retry com outro pendente, chave de idempotência por (fatura, número da tentativa).

## 6. Resolução de pagamento — todos os desfechos

- **Paid** — cancelar jobs, subscrição → ativa, entitlements repostos, Timeline + Ledger + email.
- **Partially paid** — manter a fatura em aberto pelo remanescente, recalcular score e continuar o calendário só sobre o valor em dívida.
- **Refunded** — reverter Ledger, reavaliar entitlements, encerrar recovery dessa fatura.
- **Chargeback** — parar recovery imediatamente, marcar fraude e alertar administração.
- **Failed** — nova classificação e próxima tentativa do calendário.

## 7. Painel "Revenue Recovery"

Nova página em Admin → Financeiro:

- Receita em risco, recuperada e perdida; recovery rate global.
- **Taxa de recuperação por fase**: primeiras 24h, grace period e pós-suspensão.
- **Tempo médio até recuperação** e **receita recuperada por intervalo** (24h, 15 dias, 90 dias).
- **Principais motivos de falha** e **eficácia por método de pagamento**.
- Contagens por estado (grace period, suspensos, cancelados) e, por cliente: próxima tentativa, motivo da última falha, idade da dívida e Recovery Score.

## Detalhes técnicos

- Migração: acrescentar a `billing_dunning_attempts` colunas de erro do gateway (código, mensagem, categoria), fase, score na altura da tentativa, número sequencial e chave de idempotência única; índices para o painel; vistas SQL agregadas para as métricas por fase, motivo e método.
- Novo consumidor `recovery` na fila (`src/lib/queue/handlers/recovery.server.ts`) e job types `recovery.attempt` / `recovery.escalate`; registo em `CONSUMERS` e `CONSUMERS_BY_EVENT`.
- Motor em `src/lib/billing/recovery/engine.server.ts`: agenda, executa, reagenda e cancela planos; reutiliza `chargeWithMandate` e a rotação de cartões existente.
- Transições `grace_period` e `suspended` executadas via `assertTransition`; entitlements revogados/repostos pelo consumidor de entitlements já existente.
- Funções de servidor novas com `secured()` + `write: true`, respeitando o modo apenas-leitura.
- Testes (vitest): classificador, calendário com jitter, score, teto de 15 tentativas, bloqueio com pagamento pendente, idempotência sob ticks concorrentes, e cada desfecho de resolução (parcial, reembolso, chargeback).

## Fora do âmbito (v3)

Recovery Learning Engine — aprendizagem contínua do melhor dia/hora, método com maior sucesso e intervalo ótimo por perfil de cliente. Fica como evolução natural do score depois de existirem dados suficientes.
