## Objetivo

Elevar o MM Studio a nível profissional: gerações consistentes, sem bugs visuais óbvios, que respeitam sempre as opções escolhidas, com controlo de qualidade automático inteligente e idiomas corretamente separados.

## Diagnóstico (verificado no código)

- `src/lib/studio.functions.ts` (linhas 510–524): vídeos de 15s/30s são divididos em segmentos e gerados **todos em paralelo**, cada um com o seu prompt independente. Só existe um parágrafo de texto a pedir continuidade — nada garante o mesmo rosto, roupa, unhas, luz ou enquadramento. Esta é a causa principal das inconsistências entre cenas.
- Não existe qualquer "bíblia" de personagem/cena (identidade fixa: pele, olhos, cabelo, unhas, tatuagens, acessórios, roupa).
- Narração e legendas são apenas frases no prompt (linhas 452–465). Se o modelo ignorar, ninguém deteta — o vídeo é entregue sem narração/legendas.
- Idiomas: legendas só `pt | en | es` e narração `male_pt/female_pt/...`. Não há distinção Portugal vs Brasil.
- Não existe nenhuma validação antes de entregar o resultado ao utilizador.

## 1. Bíblia de consistência (Consistency Lock)

Novo módulo `src/lib/studio-consistency.ts` que gera, uma única vez por geração, um bloco determinístico "Consistency Lock" reutilizado em **todos** os segmentos e imagens:

- Identidade da personagem: etnia, tom de pele, cor e formato dos olhos, cabelo (cor/corte), idade aparente, constituição.
- Detalhes fixos: cor das unhas, maquilhagem, tatuagens, brincos, anéis, relógio, óculos.
- Guarda-roupa: peças, cores exatas, tecidos, calçado.
- Cena: ambiente, hora do dia, direção e temperatura da luz, paleta, lente/profundidade de campo.
- Produto: forma, cores, rótulo e proporções (já ancorado nas fotos de referência).

Regras negativas explícitas contra os bugs listados: sem mudança de rosto/idade/proporções, sem objetos a aparecer ou desaparecer, sem alteração de enquadramento entre cenas, mãos e dedos anatomicamente corretos, sem texto ilegível.

Quando existe pessoa em cena e o utilizador não especifica, os traços são **preenchidos automaticamente** por uma chamada rápida ao modelo de texto (uma vez por geração) e guardados em `metadata.consistency_lock`, para poderem ser reutilizados numa regeneração ou numa nova peça da mesma campanha.

## 2. Estratégia adaptativa de segmentos

Nova função `pickContinuityStrategy()`:

- **Sequencial encadeado** quando a continuidade é essencial: `people ≠ none`, objetivos tipo UGC/lifestyle/unboxing/usage, ou hooks narrativos (antes/depois, problema→solução). Cada segmento espera pelo anterior, extrai o último frame e envia-o como imagem de referência do segmento seguinte, mais o Consistency Lock.
- **Paralelo** para produto isolado, e-commerce, apresentações e cenas independentes — mantém a velocidade atual.
- Opção avançada no formulário: **"Máxima consistência"** (toggle) que força sequencial em qualquer caso, com aviso de que demora mais.

O utilizador não tem de escolher nada: o sistema decide, e mostra na UI qual o modo aplicado.

## 3. Cumprimento garantido das opções (narração / legendas / música)

- Prompt reestruturado com uma secção **"HARD REQUIREMENTS (non-negotiable)"** onde narração, legendas e música entram como requisitos obrigatórios e não como sugestão estilística.
- Guião de narração: se o utilizador não escrever, é gerado previamente um guião no idioma escolhido, com timing por segmento — assim cada segmento sabe exatamente que texto é falado, o que também melhora a sincronização áudio/vídeo.
- Legendas derivam do guião, garantindo correspondência exata entre voz e texto no ecrã.
- Registo em `metadata.requirements` de tudo o que foi exigido, para o QC poder validar depois.

## 4. Idiomas separados (pt-PT / pt-BR)

Nova lista central de idiomas em `src/lib/studio-config.ts`:

- Português (Portugal), Português (Brasil), Inglês (US), Inglês (UK), Espanhol (ES), Espanhol (LATAM), Francês, Italiano, Alemão.

Aplicada tanto a legendas como a narração (voz masculina/feminina/neutra × idioma), em vez dos enums fixos atuais. O prompt passa a instruir vocabulário e sotaque europeus para pt-PT ("tu", "telemóvel", "estás") vs brasileiro. Valores antigos (`pt`, `male_pt`) continuam a ser aceites e mapeados para pt-PT, para não partir gerações já guardadas.

## 5. Controlo de qualidade inteligente (antes da entrega)

Novo `src/lib/studio-qc.server.ts`, executado no fim do polling, antes de marcar o asset como pronto:

**Verificações técnicas (determinísticas, alta confiança):**
- Ficheiro válido e com duração esperada.
- Presença de faixa de áudio quando foi pedida narração.
- Presença de legendas / número de segmentos prontos vs esperados.
- Segmentos em falta ou corrompidos.

**Verificações visuais (modelo multimodal, frames amostrados):**
- Consistência de personagem entre o primeiro e o último frame de cada segmento e entre segmentos (rosto, roupa, unhas, acessórios, cabelo).
- Deformações graves de mãos/rosto.
- Texto ilegível queimado na imagem.
- Saltos bruscos de enquadramento ou iluminação.

Cada verificação devolve severidade e confiança. Só falhas **técnicas evidentes** ou **inconsistências graves com confiança elevada** disparam ação. Diferenças criativas ou subjetivas nunca disparam.

## 6. Regeneração automática controlada

- No máximo **1 regeneração automática por geração** (`metadata.auto_retry_count`).
- Só regenera os segmentos problemáticos, reutilizando o Consistency Lock e, no modo sequencial, o frame de referência.
- **Sem custo de créditos para o membro**; o custo é absorvido pelo MM Club.
- Nova tabela `mm_studio_qc_log` regista: asset, motivo, verificações falhadas, confiança, segmentos regerados, créditos absorvidos e utilizador — para monitorizar custo e detetar abuso.
- Nova definição em `billing_settings`: **limite mensal de créditos absorvidos** (valor por defeito configurável no admin). Quando o limite do mês é atingido, o sistema deixa de regerar sozinho e mostra ao utilizador: "Detetámos um problema nesta geração — queres repetir?" com confirmação explícita de custo.
- Se após a regeneração o problema persistir, entrega-se o melhor resultado com um aviso claro na UI em vez de entrar em ciclo.

## 7. Qualidade geral e UI

- Prompts de imagem e vídeo reescritos com uma ordem estável: requisitos obrigatórios → consistency lock → direção criativa → regras anti-bug → especificação técnica.
- Imagens em lote passam a partilhar o mesmo Consistency Lock, para as variações serem coerentes entre si.
- Na UI de vídeo (`_app.ferramentas.studio.videos.tsx`): seletor de idioma separado para narração e legendas, toggle "Máxima consistência", indicação do modo (sequencial/paralelo) e badge de QC no resultado ("Verificado", "Corrigido automaticamente", "Entregue com aviso").
- Painel do asset mostra o relatório de QC resumido.

## Notas técnicas

- Ficheiros novos: `src/lib/studio-consistency.ts`, `src/lib/studio-qc.server.ts`, `src/lib/studio-languages.ts`.
- Alterados: `src/lib/studio-config.ts`, `src/lib/studio-prompt.ts`, `src/lib/studio.functions.ts`, `src/routes/_app.ferramentas.studio.videos.tsx`, `src/routes/_app.ferramentas.studio.imagens.tsx`.
- Migração: tabela `mm_studio_qc_log` (com GRANT + RLS por `auth.uid()`, escrita apenas server-side) e chave de configuração do limite mensal em `billing_settings`.
- A geração sequencial usa a extração do último frame do segmento anterior como imagem de referência do seguinte — o pipeline Omni já aceita imagens de entrada, portanto não há dependência nova de codecs no runtime do servidor.
- Retrocompatibilidade garantida para assets e enums antigos.
