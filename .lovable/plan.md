# Lançamento de cursos agendados — o que falta

## Estado actual (verificado)

- O agendamento existe: no Admin → Cursos podes definir a data (`releaseAt`) e o curso fica bloqueado como "Em breve" até essa hora.
- O contador regressivo já aparece na página do curso e desaparece quando chega a zero.
- O desbloqueio automático **não** acontece em tempo real: o acesso só é reavaliado quando a pessoa recarrega ou volta a navegar para a página. Quem estiver com a página aberta vê o contador acabar e continua bloqueado.
- **Não existe nenhum email de lançamento.** O único email de cursos é o aviso diário de "Em breve" (`upcoming-courses`, todos os dias às 11h). Não há tarefa agendada nem notificação/push quando o curso é efectivamente liberado.

Ou seja: a hora chega, o curso passa a estar disponível (após recarregar), mas ninguém é avisado.

## O que vou implementar

1. **Desbloqueio ao segundo**
   - Quando o contador atinge zero, a página passa automaticamente do estado "Em breve" para o curso disponível, sem recarregar (na lista da Academia e na página do curso).

2. **Anúncio automático de lançamento (email para todos)**
   - Nova tarefa agendada que corre a cada 5 minutos e detecta cursos cuja hora de lançamento acabou de passar.
   - Envia um email de lançamento ("Já está disponível: <curso>") a todos os membros com subscrição activa ou em trial, respeitando as preferências de email (quem desactivou avisos de cursos não recebe).
   - Cada membro recebe uma única vez por curso (chave de idempotência por curso), mesmo que a tarefa corra várias vezes.
   - Novo modelo de email com a capa do curso, título, tagline e botão para abrir o curso.

3. **Sino + push**
   - Notificação no centro de notificações e push no PWA para o mesmo evento, no mesmo momento do email.

4. **Verificação**
   - Testo com um curso agendado para dentro de 1 minuto: confirmo desbloqueio automático, envio único de email e chegada da notificação.

## Notas técnicas

- Nova rota `src/routes/api/public/hooks/course-released.ts` (autenticada com o segredo de cron, como os restantes hooks), agendada via `pg_cron` a cada 5 minutos.
- Fonte do catálogo igual à do hook `upcoming-courses`: cursos estáticos + `admin_overrides`.
- Estado de "já anunciado" guardado no `email_log` por `kind: course_released` + `ref: <courseId>`; sem tabelas novas.
- Janela de detecção: lançamentos ocorridos nas últimas 48h ainda são anunciados (protege contra falhas de execução), mas nunca duas vezes.
- `ReleaseCountdown` passa a avisar o pai quando termina (via callback) e o `useCourseAccess` reavalia com o ticker central já existente.
