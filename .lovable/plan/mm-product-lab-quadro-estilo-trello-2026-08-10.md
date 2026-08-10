# MM Product Lab — Quadro estilo Trello

Transformar o Product Lab num quadro de arrastar-e-largar, e separar "adicionar produto" de "analisar com IA".

## 1. Quadro com colunas arrastáveis

- Colunas: Encontrados, Em análise, Validados, Em teste, Vencedores, Rejeitados (as que já existem em `PL_STATUSES`).
- Arrastar um cartão de uma coluna para outra muda o estado do produto imediatamente (atualização otimista + gravação no backend). Exemplo: arrastar "Produto X" para "Em teste".
- No telemóvel, além do arrasto por toque, mantém-se o menu rápido "Mover para…" no cartão.
- Cada coluna mostra contagem, cor própria e realce quando o cartão está a ser largado ali.
- Colunas vazias mostram uma zona pontilhada "Larga um produto aqui".

## 2. Cartões mais informativos

Cada cartão passa a mostrar, quando existir:
- imagem, nome, categoria, preço e margem
- Score MM
- Fornecedor (nome/domínio)
- Nº de concorrentes registados
- Estado da análise IA (Ainda não analisado / Vale a pena aprofundar / Precisa validação / Baixo potencial)

## 3. Adicionar produto = rápido, sem análise

- Colar link → o sistema apenas extrai dados da página (nome, imagem, preço, moeda, fonte, fornecedor, mercado) e guarda o produto na coluna escolhida (por omissão "Encontrados").
- O passo de IA sai deste fluxo: adicionar fica instantâneo.
- No diálogo de adicionar, um selector permite escolher a coluna de destino.

## 4. Análise IA passa a ser ação separada

- Botão "Analisar com IA" no cartão (menu) e na página do produto.
- Corre a análise existente e guarda o resultado; o cartão passa a mostrar a recomendação.
- Opção "Analisar e mover para Em análise" para quem quiser o fluxo antigo.

## Notas técnicas

- Drag-and-drop com `@dnd-kit/core` + `@dnd-kit/sortable` (suporte a rato, toque e teclado).
- Reutiliza `setProductStatus`; adiciona atualização otimista na cache `["product-lab","list"]` para o cartão mudar de coluna sem esperar a rede.
- `mineProduct`/`saveMinedProduct` em `src/lib/product-lab-mine.functions.ts` deixam de chamar a IA no caminho de gravação; a extração determinística do `product-lab-mine.server.ts` mantém-se.
- `analyseProduct` em `src/lib/product-lab.functions.ts` mantém-se igual, apenas passa a ser invocado sob pedido.
- Ficheiros tocados: `_app.ferramentas.product-lab.index.tsx` (novo componente `board.tsx` para as colunas/cartões), `mine-dialog.tsx`, `product-lab-mine.functions.ts`.
