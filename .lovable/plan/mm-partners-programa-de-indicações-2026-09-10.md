# MM Partners — programa de indicações

Cada membro pode entrar no MM Partners, receber um link próprio e ser recompensado
por quem trouxer para o clube.

## Regras acordadas

- Qualquer membro com conta pode inscrever-se (inclui trial e contas suspensas).
- Contam apenas indicados com **plano pago ativo**.
- Com **3 indicados ativos ao mesmo tempo**: o parceiro tem o **MM Club Start grátis**
  enquanto os 3 se mantiverem ativos. Se tiver um plano superior, paga só a diferença.
- **A partir do 4.º** indicado pago: **5 € uma única vez** por cada novo indicado.
- Os 5 € vão para um **saldo**; o parceiro pede retirada e o pagamento é feito à mão
  pela equipa (IBAN / MB Way), com aprovação no admin.
- Se um dos 3 indicados deixar de pagar, o benefício grátis pausa automaticamente
  (o saldo já ganho nunca é retirado).

## Experiência do membro

Nova página **/parceiros**:
- Botão de adesão (aceitar regras) e link pessoal com botão copiar + partilhar
  (WhatsApp, Instagram, email).
- Cartões: indicados a pagar agora, total de indicados, saldo disponível, saldo pago.
- Barra "faltam X para o MM grátis" (0/3) e aviso quando o benefício está ativo.
- Lista de indicados: nome/inicial, data de entrada, estado (pago, trial, cancelado)
  e recompensa gerada.
- Zona de retiradas: pedir retirada (mínimo 25 €), escolher IBAN/MB Way, ver histórico
  e estado (pedido, pago, recusado).
- Entrada no menu lateral e cartão no painel a convidar quem ainda não é parceiro.

## Admin

Novo separador em **/admin/parcerias** → "MM Partners":
- Ranking de parceiros: indicados ativos, total pago, saldo pendente, benefício grátis on/off.
- Pedidos de retirada com dados de pagamento, botão "Marcar como pago" ou "Recusar" (com nota).
- Vista por indicado, para conferir com o financeiro.

## Detalhes técnicos

Base de dados (migração única, com GRANT + RLS):
- `mm_partner_accounts` — user_id, code (curto, único), estado, aceitou_em, dados de pagamento
  (método, iban/telefone, titular), totais em cache.
- `mm_partner_referrals` — partner_id, referred_user_id (único), code usado, primeira
  origem (landing/checkout), estado calculado, first_paid_at, reward_cents, reward_kind
  (`free_slot` | `cash`), created_at.
- `mm_partner_ledger` — partner_id, tipo (`cash_reward`, `withdrawal`, `adjustment`),
  cents, referral_id, memo — imutável; saldo = soma.
- `mm_partner_payouts` — pedido de retirada: cents, método, destino, estado
  (`requested`|`paid`|`rejected`), notas, quem aprovou.
- RLS: cada parceiro lê só as suas linhas; escrita de recompensas só por service role;
  admin vê tudo via `has_role`.

Captura da indicação:
- `?ref=CODE` em qualquer rota pública guarda o código em cookie 90 dias + localStorage.
- No primeiro login/criação de perfil, um server fn liga o código ao novo utilizador
  (uma vez, sem auto-indicação, sem cadeias).

Atribuição da recompensa (server-only, idempotente):
- No processamento do evento de pagamento existente (`billing` consumers / webhook),
  ao confirmar o primeiro pagamento de um indicado: marca `first_paid_at` e decide
  `free_slot` (se o parceiro tiver menos de 3 lugares ocupados) ou lança 5 € no ledger.
- Reavaliação diária no cron existente de billing: recalcula indicados ativos, ativa/pausa
  o desconto do parceiro e emite email quando muda.
- Benefício grátis aplicado como desconto recorrente no valor do Start (2990) na próxima
  fatura do parceiro, através da camada de cupões/ajustes já existente — nunca alterando
  o plano dele.
- Anti-abuso: sem auto-indicação, mesmo email/utilizador não conta duas vezes, indicado
  reembolsado ou com chargeback anula a recompensa (lançamento inverso no ledger).

Server fns novas em `src/lib/partners.functions.ts` (membro) e
`src/lib/partners-admin.functions.ts` (admin), com lógica em
`src/lib/partners/*.server.ts`. Emails de "primeiro indicado pago", "MM grátis ativo",
"MM grátis pausado" e "retirada paga" via `src/lib/email.server.ts`.
