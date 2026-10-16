# Concluir os alertas de pagamentos, lives e IA

## Já corrigido
- A verificação Paddle de 0 € numa subscrição existente apenas associa a cobrança futura: não prolonga acesso, não regulariza dívida e não regista receita.
- Uma quota de vídeo confirmada como cheia bloqueia novas gravações e avisa o anfitrião, sem interromper gravações já em curso.
- 13 testes passaram; aplicação sem erros de compilação. Não foi publicada nem foram apagadas gravações.

## Migração dos modelos de IA
A alteração abrange assistência, resumos semanais, chat, moderação, quizzes, Product Lab, controlo de qualidade e capas. Migrar por grupos e verificar cada funcionalidade, em vez de trocar nomes indiscriminadamente.

- Gemini 2.5 Flash → Gemini 3.8 Flash para assistência e chat: preserva texto/imagens e o protocolo atual, com maior capacidade. Preço de catálogo por milhão de tokens de texto: entrada $0,30 → $0,75; saída $2,50 → $3,75.
- Gemini 3.6 e 3.7 Flash → Gemini 3.8 Flash: geração, análise e qualidade com o mesmo preço base de entrada/saída ($0,75/$3,75). Retirar também o fallback descontinuado Gemini 3.5 da moderação, mantendo a política permissiva e as sanções atuais.
- Gemini 3.1 Flash Image → Gemini 3 Pro Image para capas com pessoas e fallback de imagens: protocolo compatível e melhor preservação visual; preço de catálogo de saída de imagem $60 → $120 por milhão de tokens, entrada de texto $0,50 → $2.
- Manter modelos ativos, incluindo Gemini 3.1 Flash Lite, GPT Image 2, embeddings e Veo 3.1 Fast.
- Verificar se a transcrição antiga usa realmente a Lovable AI ou OpenAI direto antes de decidir qualquer mudança; não alterar fornecedores fora do âmbito do alerta.
- Preservar prompts, limites obrigatórios, encaminhamento condicional, comportamento de streaming e segurança. Remover limites opcionais apenas nas chamadas efetivamente melhoradas, conforme a política dos modelos.
- Testar respostas reais de cada grupo e interromper a validação se houver recusa, falta de créditos ou indisponibilidade.

O catálogo autenticado confirmou descontinuação, mas não indicou redirecionamentos automáticos. Datas explícitas de expiração: Gemini 2.5 Flash, 20/10/2026; Gemini 3.6 Flash, 19/11/2026; Gemini 3.7 Flash, 28/01/2027. Não há data confirmada para Gemini 3.1 Flash Image ou 3.5 Flash. Os substitutos propostos têm retenção zero no protocolo utilizado.

## Dependências para os outros alertas
- **Cloudflare:** a consulta atual devolve 403 Authorization Failure. Restabelecer autorização da conta com Stream Read/Edit por ligação segura; voltar a testar segmentos e quota. Não apagar vídeos nem aumentar um plano pago sem autorização específica.
- **Quota:** após recuperar autorização, verificar o consumo atual e apresentar as opções de libertar espaço ou aumentar capacidade. A proteção de código não resolve a capacidade da conta.
- **Chat:** a leitura da live, a entrada na sala e o envio usam a mesma função de acesso; já existe mensagem amigável. Identificar um membro e uma live afetados para reproduzir antes de alterar permissões. Nunca usar mera existência de participante como autorização, pois o registo pode ser criado pelo próprio utilizador.
- **Pagamentos históricos:** existem sete verificações Paddle de 0 € marcadas como pagas com subscrição associada. Comparar o período real no Paddle, cobranças e histórico de acessos antes de propor correções individuais; não retirar acesso nem corrigir contas em massa por suposição.

## Detalhes técnicos
- Centralizar apenas as escolhas de modelos migrados em módulos server-only; adaptar os formatos de imagem conforme a documentação da Lovable AI.
- Acrescentar testes de reconciliação de pagamentos e de cada regra de acesso alterada; verificar fluxos autenticados com dados de teste, sem cobranças reais.
- Concluir ou classificar os alertas de monitorização apenas após verificar o resultado relevante; os alertas externos permanecem abertos enquanto a autorização/capacidade não for resolvida.
- **Não publicar.**