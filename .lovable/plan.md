## Estado verificado (auditoria já feita)

Base sólida: 79/83 funções de servidor exigem sessão válida; todas as ações admin verificam o papel no backend; RLS ativo em todas as tabelas; segredos (Mollie, LiveKit, Cloudflare, OpenAI, Service Role) só existem em ficheiros de servidor.

Falhas reais encontradas:

| Risco | Gravidade | Localização | Impacto |
|---|---|---|---|
| Configuração interna do admin legível sem login | Alta | leitura de `admin_overrides` | Exposição de configuração e estrutura interna |
| Media de cursos/vídeos descarregável por qualquer conta autenticada | Alta | regras de `course-media`, `lesson-videos` | Conta grátis acede a conteúdo pago |
| Upload livre para os buckets de cursos | Média | mesmas regras | Abuso de armazenamento |
| Sem limites de utilização em lado nenhum | Média | toda a API | Força bruta, abuso financeiro |
| Proteção contra passwords vazadas desligada | Média | definições de autenticação | Contas fracas |
| Webhook de pagamentos sem assinatura/anti-replay explícitos | Média | endpoint de webhook | Reprocessamento de eventos |
| Uploads sem validação de tipo/tamanho no servidor | Média | shorts, avatares, comunidade | Ficheiros maliciosos |

## Plano (7 fases)

**Fase 1 — Security Gate único (a camada comum que pediu)**

Uma única cadeia de segurança que todas as funções de servidor e endpoints atravessam, pela ordem: autenticação → autorização (papel/entitlement) → limite de utilização → WAF lógico → validação de entrada → regras de negócio → função.

- Cada função passa a declarar apenas a sua política (`{ auth: true, role: 'admin', limit: '10/min', schema }`); nunca reescreve segurança.
- Uma função sem política declarada é rejeitada por omissão (fail-closed) — impossível "esquecer" uma validação.
- Os mesmos controlos aplicam-se aos endpoints públicos (webhooks, cron), com verificação de assinatura em vez de sessão.

**Fase 2 — Fechar os buracos críticos**
- `admin_overrides` legível só por administradores.
- Media de cursos e vídeos: leitura só com o direito correspondente, escrita só admin; downloads sempre por link assinado de curta duração.
- Validação de tipo real, extensão e tamanho no servidor antes de qualquer upload.
- Proteção contra passwords vazadas ativada.

**Fase 3 — Billing, Mollie e anti-abuso financeiro**
- Preços, planos, descontos, cupões, faturas, créditos e permissões calculados sempre no servidor a partir do catálogo; nada aceite do pedido.
- Verificação de propriedade em cada operação (a fatura/subscrição é mesmo do requerente).
- Limites financeiros por utilizador **e** por IP: número máximo de checkouts por hora/dia, de tentativas de pagamento, de métodos adicionados, de emails e de jobs gerados. Checkout repetido reutiliza a intenção existente em vez de criar nova.
- Webhooks: assinatura verificada, janela de tempo, proteção contra reenvio e idempotência por evento.

**Fase 4 — WAF lógico e Kill Switch**
- Deteção de padrões suspeitos por utilizador, não só volume: upgrades repetidos, ciclos cancelar/reativar, alternância de métodos de pagamento, tentativas repetidas de acesso negado. Escalada automática: abrandar → exigir confirmação → bloquear e registar.
- **Modo de Emergência** com um botão no painel admin: bloqueia em segundos novos checkouts, novas cobranças, criação de contas, uploads e endpoints públicos não essenciais, mantendo o acesso de leitura a membros autenticados. Estado guardado nas definições e lido pelo Security Gate a cada pedido, com registo de quem ativou e porquê.

**Fase 5 — Proteção contra enumeração**
- Respostas uniformes em recuperação de password, registo, verificação de email e login: sempre "Se existir uma conta com esse email, enviaremos instruções."
- Sem distinção entre "não existe" e "sem permissão" em faturas, subscrições, perfis e IDs: a mesma resposta genérica e o mesmo tempo de resposta.

**Fase 6 — Auditoria de Service Role e registo de ações admin**
- Inventário completo de cada utilização da chave privilegiada: onde, porquê e se pode ser substituída pela sessão do utilizador. Substituir sempre que possível; o que ficar tem justificação escrita no relatório.
- Todas as ações administrativas registadas com autor, data/hora, IP, browser, localização aproximada, valor anterior e valor novo (ex.: alteração de preço fica com o antes e o depois).

**Fase 7 — Security Dashboard, monitorização e resposta a incidentes**
- Tabela de eventos de segurança alimentada automaticamente pelo Security Gate: falhas de login, acessos admin, pedidos bloqueados por autorização, bloqueios por limite ou WAF, falhas de webhook e eventos de cobrança anómalos.
- Página `/admin/seguranca` (só admin): estado do Modo de Emergência, alertas ativos, gráfico de falhas, top IPs, últimos bloqueios, histórico pesquisável e exportável.
- Regras de alerta com email ao administrador (picos de falhas de login, série de acessos negados, criação anormal de checkouts, alterações admin invulgares).
- Procedimento escrito de resposta a incidentes: como detetar, conter (Modo de Emergência), investigar pelo histórico, recuperar e comunicar.
- Nunca são registados passwords, tokens, chaves ou dados de cartão.

## Pen test e relatório final

Simulação de ataque via browser controlado e chamadas diretas tipo Postman: escalar privilégios, ler dados de outros utilizadores, manipular preço/fatura/subscrição/pagamento, marcar fatura como paga, criar créditos, descarregar media privada, chamar APIs internas, reutilizar webhooks e sessões expiradas, enumerar emails e IDs.

Relatório em `docs/security-audit.md` com, para cada vulnerabilidade: risco, gravidade, localização, impacto, solução e prova do teste — mais uma **classificação OWASP Top 10** em formato PASS/FAIL (Broken Access Control, Falhas Criptográficas, Injeção, Design Inseguro, Configuração, Componentes Vulneráveis, Autenticação, Integridade de Dados, Falhas de Registo/Monitorização, SSRF).

## Notas técnicas

- Alterações de acesso a dados e storage feitas por migrações; nada validado apenas no frontend.
- Limites de utilização implementados à medida (contadores em base de dados com janela deslizante) — a plataforma não oferece um mecanismo padrão.
- XSS: revisão de todos os pontos onde é mostrado conteúdo de utilizador (comentários, chat, perfis, lives, shorts), com sanitização de markdown se aplicável.
- CSRF: as chamadas são same-origin e autenticadas por cabeçalho, não por cookie — será confirmado que nenhuma operação crítica depende de cookies.
- SQL sempre parametrizado, sem concatenação.
