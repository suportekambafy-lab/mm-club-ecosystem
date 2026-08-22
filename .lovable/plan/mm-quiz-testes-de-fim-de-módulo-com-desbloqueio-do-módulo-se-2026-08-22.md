# MM Quiz — testes de fim de módulo com desbloqueio do módulo seguinte

Acho excelente ideia: é o que transforma "ver vídeo" em "aprender de verdade". E sim, já temos transcrições prontas (47 aulas com transcrição indexada), por isso as perguntas podem ser geradas a partir do conteúdo real das aulas — nada genérico.

## Como vai funcionar para o membro

1. Termina todas as aulas de um módulo → aparece o cartão "Teste do módulo" no fim da lista.
2. O teste tem 5 perguntas de escolha múltipla (4 opções, 1 correta), geradas a partir das transcrições das aulas daquele módulo.
3. Nota mínima de aprovação: 80% (4 de 5). Se falhar, vê explicação de cada resposta errada com o link direto para o minuto da aula e pode repetir (perguntas embaralhadas).
4. Só depois de aprovar é que o módulo seguinte fica desbloqueado. Módulos bloqueados aparecem com cadeado e a mensagem "Conclui o teste do módulo anterior".
5. Aprovação entra na ofensiva de estudo (streak) e conta para o certificado — o certificado passa a exigir aulas concluídas **e** todos os testes aprovados.

Excepções: admins e moderadores nunca ficam bloqueados; o primeiro módulo está sempre aberto.

## Geração das perguntas (automática, com revisão)

- Um gerador usa a IA da plataforma sobre as transcrições do módulo e cria 6–8 perguntas com resposta correta, explicação curta e referência (aula + minuto).
- As perguntas ficam guardadas (não são geradas a cada tentativa), por isso são consistentes e rápidas.
- No admin (nova aba "Quizzes"): ver/gerar/regenerar por módulo, editar texto de pergunta/opções, marcar pergunta como inativa, publicar ou despublicar o teste. Módulo sem teste publicado não bloqueia nada — a app só exige o que estiver publicado.
- Aulas sem transcrição são ignoradas na geração; se um módulo não tiver transcrições suficientes, o admin vê aviso.

## Painel do admin

- Taxa de aprovação por módulo, nota média, número de tentativas e perguntas com mais erros (indica aulas confusas).
- Vista por aluno: em que módulo está travado.

## Detalhes técnicos

Base de dados (nova migração, com GRANTs e RLS):
- `quiz_questions` — course_id, module_id, prompt, options (jsonb), correct_index, explanation, lesson_id, start_seconds, active, ordem. Leitura por `authenticated` sem revelar resposta: o cliente lê através de uma função servidora que remove `correct_index`; escrita só staff.
- `quiz_module_settings` — course_id, module_id, published, pass_score, question_count.
- `quiz_attempts` — user_id, course_id, module_id, score, passed, answers (jsonb), created_at. RLS: o próprio vê as suas; staff vê todas via `has_role`.

Servidor (`src/lib/quiz.functions.ts` + `quiz.server.ts`):
- `getModuleQuiz` (autenticado): devolve perguntas embaralhadas **sem** a resposta correta.
- `submitModuleQuiz`: corrige no servidor, grava tentativa, devolve nota + explicações + referências.
- `getCourseQuizState`: por curso, devolve módulos aprovados/bloqueados (usado na lista de aulas e no gating).
- `generateModuleQuiz` (staff): lê `lesson_transcripts` do módulo, chama o gateway de IA (Gemini Flash) com saída JSON validada por Zod, faz upsert das perguntas.
- `getQuizAnalytics` (staff) para o painel.

Front-end:
- `src/components/mm/module-quiz.tsx` — cartão + modal do teste (uma pergunta por ecrã, barra de progresso, resultado com explicações e link `?t=` para o minuto).
- `src/routes/_app.academia.$courseId.index.tsx` — cadeado nos módulos bloqueados e cartão de teste no fim de cada módulo concluído.
- `src/routes/_app.academia.$courseId.$lessonId.tsx` — se a aula pertence a módulo bloqueado, redirecionar para a página do curso com aviso.
- `src/routes/admin.aulas.tsx` (ou nova rota `admin.quizzes.tsx`) — gestão e analítica.
- Certificados: `certificates.server.ts` passa a exigir testes aprovados; a página `/certificados` mostra "faltam X testes".
