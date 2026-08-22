# MM Club — Ronda de melhorias (retenção, receita, experiência, operação)

Plano em 4 frentes, com melhorias ao que já existe e um conjunto de funcionalidades novas de alto impacto. Ordenado por impacto/esforço: F1 primeiro, F4 no fim.

## F1 — Retenção e engagement do aluno

1. **Streak de aprendizagem + metas semanais**
   Contador de dias consecutivos com atividade (aula vista, post, comentário), meta semanal de minutos, aviso no sino quando a streak está em risco. Nada disto existe hoje no produto.
2. **Certificados de conclusão de curso**
   Ao completar 100% das aulas: certificado PDF com nome, curso, horas e código de verificação, com página pública `/certificado/$codigo` e botão de partilha (LinkedIn/WhatsApp). Reutiliza a geração de PDF já usada nas faturas.
3. **"Continuar onde parei" mais forte no dashboard**
   Bloco fixo no topo com a aula em curso, percentagem, próxima aula e tempo restante; hoje a continuação existe mas está diluída entre rails.
4. **Quiz rápido no fim da aula (3 perguntas)**
   Aparece no overlay de fim de aula já existente; acerto marca a aula como "dominada" e soma pontos ao score da comunidade.
5. **Digest semanal por email**
   Um email por semana: o teu progresso, top 3 posts da comunidade, próximas lives, aula recomendada. Respeita as preferências de email já existentes.
6. **Notas pessoais na aula com timestamp**
   Painel lateral para escrever notas ancoradas ao minuto do vídeo, com lista em `/perfil` e clique para saltar ao momento.

## F2 — Receita e conversão

1. **Programa de indicações (referrals)**
   Link único por membro, tracking de conversão, recompensa configurável (mês grátis ou créditos MM Studio). Painel de indicações no `/subscricao` e relatório no admin.
2. **Página de planos com comparação e prova social**
   Comparativo Start/Plus/Elite, FAQ de objeções, número de membros, testemunhos; CTA persistente em mobile.
3. **Anti-churn no cancelamento**
   Fluxo de retenção antes de cancelar: motivo, oferta de pausa (1-2 meses) ou desconto, downgrade em vez de saída. Registado no timeline de billing.
4. **Upsell contextual dentro da app**
   Cartões de upgrade nos pontos de fricção (limite de créditos MM Studio, curso bloqueado, live premium), com métricas de clique e conversão.
5. **Recuperação de checkout abandonado**
   Sequência de email/push para intents de checkout não concluídos nas últimas 24-72h.
6. **Painel de métricas de crescimento no admin**
   MRR, churn, LTV, conversão do trial, coorte por mês de entrada, num único ecrã.

## F3 — Experiência e velocidade

1. **Auditoria mobile-first de cada página** de membro: alvos de toque, densidade, barras fixas, safe-areas iOS, e correção do que sair fora do padrão.
2. **Consistência visual**: revisão de tokens (cores, espaçamento, raio, tipografia), skeletons uniformes e estados vazios com ação clara em todas as listas.
3. **Performance**: code-splitting das rotas mais pesadas (studio, admin, comunidade), pré-carregamento de imagens críticas, redução de trabalho no primeiro render do dashboard.
4. **Busca global melhorada**: resultados agrupados (aulas, posts, lives, ferramentas), atalho de teclado, histórico recente.
5. **Acessibilidade e robustez**: foco visível, leitura por teclado nos modais, mensagens de erro amigáveis com retry em vez de ecrãs em branco.
6. **Offline/PWA**: ecrã offline decente e reentrada suave após perda de rede em lives e comunidade.

## F4 — Operação e admin

1. **Centro de operações**: um ecrã com sinais de saúde (jobs, webhooks, transcrições, cron, erros recentes) e ações rápidas de reprocessamento.
2. **MM Suporte com métricas**: taxa de resolução automática, escalações para humano, temas mais frequentes, e lacunas de conhecimento a documentar.
3. **Moderação — relatório semanal**: volume por regra, reincidentes, recursos pendentes, tempo médio de revisão.
4. **Gestão de conteúdo mais rápida**: ações em lote em cursos/aulas (publicar, agendar, reordenar) e duplicação de aula/curso.
5. **Comunicações segmentadas**: envio de email/push por segmento (trial, ativos, inativos 14 dias, plano X) com pré-visualização e teste.

## Notas técnicas

- Novas tabelas previstas: `learning_streaks`, `lesson_notes`, `lesson_quiz_attempts`, `course_certificates`, `referrals`, `referral_rewards`, `cancellation_feedback`. Todas com GRANTs explícitos + RLS por `auth.uid()`, e acesso de staff via `has_role`.
- Certificados e digest via server functions (`createServerFn`), PDF com `pdf-lib` como nas faturas; página pública de verificação sob rota pública com leitura restrita a `anon` apenas do código, curso e nome.
- Referrals e recuperação de checkout ligam-se ao billing existente (`billing_checkout_intents`, `billing_timeline`, `billing_coupons`) — sem motor de pagamentos novo.
- Digest semanal, streak-at-risk e recuperação de checkout entram como jobs `pg_cron` sobre rotas `/api/public/hooks/*` com verificação de segredo, seguindo o padrão já usado.
- Sem alteração ao router, à autenticação ou ao motor de moderação existentes.

## Execução

Entrego por fases, cada uma testável de forma independente: F1 → F2 → F3 → F4. Posso começar por F1 (1, 2, 3) que é o que mexe mais em retenção percebida, e depois F2 (1, 3) que é receita direta.
