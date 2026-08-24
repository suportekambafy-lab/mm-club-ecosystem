# Avaliação do MM Club e plano de nível premium

## Nota geral

Funcionalidades: 9/10. Design: 7,5/10. Aprendizagem real: 6/10. Operação: 8/10.

O produto tem muito mais do que a maioria das plataformas do mercado (academia, lives com sala interativa e replays, comunidade moderada por IA, quizzes, notas, ofensivas, certificados, MM Studio, Product Lab, billing próprio com recovery, suporte com IA). O problema hoje não é falta de funcionalidades — é **profundidade de uso**: há muita coisa construída que quase ninguém está a usar.

## O que os dados reais mostram (verificado agora)

- 85 perfis; 34 subscrições ativas, 36 em trial, 6 em grace period.
- 69 membros com progresso registado, 905 registos, 436 aulas concluídas.
- Mas só **21 membros com atividade nos últimos 7 dias** — cerca de 1 em cada 4.
- Progresso concentrado num único curso: Marca Milionária 371 conclusões, Start Afiliado 62, os outros dois cursos somam 3 conclusões e 1 utilizador.
- Quizzes: 59 perguntas, **apenas 8 módulos publicados**, 28 tentativas.
- **0 certificados emitidos**, 5 notas de aula criadas no total, 26 posts na comunidade, 3 shorts.
- 48 aulas com transcrição (base para quizzes/IA já existe).

Leitura: alguém entra hoje e **consegue** aprender — há um curso completo, com vídeo real, progresso, quiz em alguns módulos e IA que responde. Mas o percurso não é guiado: não há uma ordem óbvia, a maior parte dos módulos não tem teste publicado, ninguém chegou ao certificado, e as ferramentas de estudo (notas, ofensiva) passam despercebidas.

## Onde o design ainda não é premium

- Densidade desigual entre páginas: dashboard e academia estão bons, comunidade e perfil acumularam camadas (a comunidade tem mais de 2000 linhas num só ecrã).
- Estados vazios fracos: quem entra sem progresso vê grelhas vazias em vez de um convite claro ao primeiro passo.
- Hierarquia da aula: player, notas, recursos, quiz e conhecimento competem pela mesma atenção.
- Falta um momento de recompensa visível (conclusão de módulo/curso) à altura do resto.

## Plano de melhoria — 3 fases

### Fase 1 — Tornar a aprendizagem inevitável (maior impacto)

1. **Trilho guiado do membro**: um percurso único recomendado (curso → módulo → aula seguinte) com um bloco "o teu próximo passo" fixo no topo do dashboard e no início da academia.
2. **Cobertura total de quizzes**: gerar e publicar testes para todos os módulos com transcrição, com revisão rápida em lote no admin (hoje só 8 estão publicados).
3. **Marco de conclusão de módulo**: ecrã de celebração ao passar o teste, com o que foi desbloqueado e o passo seguinte.
4. **Certificado visível desde o dia 1**: barra de progresso do certificado no curso e no `/certificados` ("faltam X aulas e Y testes"), e emissão automática à conclusão.
5. **Primeira sessão orientada**: para quem nunca viu nada, um ecrã de arranque com 3 passos (ver primeira aula, escolher objetivo, ativar notificações) em vez de rails vazios.

### Fase 2 — Ritmo semanal e comunidade viva

1. **Ritual semanal**: meta de minutos + resumo de domingo por email/push com o que falta para fechar o módulo (encaixa nas ofensivas e no cron já existente).
2. **Comunidade com propósito**: tópico semanal fixo (desafio/pergunta da semana) e destaque de resultados de membros, para elevar os 26 posts.
3. **Notas e MM Inteligência à vista na aula**: painel de estudo com sugestão automática ("guardar este momento") em vez de funcionalidade escondida.
4. **Reativação dos cursos esquecidos**: campanha segmentada para quem só viu Marca Milionária, com trilho de entrada nos restantes cursos.

### Fase 3 — Polimento premium e medição

1. **Revisão de design página a página** (mobile primeiro): comunidade e perfil divididos em secções, densidade e tipografia consistentes, estados vazios com ação.
2. **Hierarquia da aula**: player em foco, restantes painéis em separadores.
3. **Velocidade**: divisão de código das rotas pesadas (comunidade, studio, admin) e primeiro render mais leve no dashboard.
4. **Painel de saúde de aprendizagem no admin**: ativos 7/30 dias, conclusão por módulo, taxa de aprovação nos testes, certificados emitidos — para medir o efeito das fases 1 e 2.

## Notas técnicas

- Fase 1 usa o que já existe: `lesson_progress`, `quiz_module_settings`/`quiz_questions`, `lesson_transcripts`, `course_certificates`, `learning_activity`. Não prevejo tabelas novas, no máximo uma coluna de "objetivo/trilho" no perfil.
- Geração de quizzes em lote via as server functions de quiz já usadas, com publicação manual no admin.
- Resumo semanal entra nos crons existentes (`weekly-summary`, `streak-guard`), sem novo motor de email.
- Fase 3 é sobretudo frontend; sem alterações ao router, autenticação ou billing.

## Execução

Sugiro começar pela Fase 1 (pontos 1, 2 e 4) — é o que transforma "dá para aprender" em "é difícil não aprender" — e medir com o painel da Fase 3.4 antes de avançar.
