# Design Premium — refinamento visual do MM Club

Objetivo: elevar a área de membros a um nível "premium editorial" (preto/dourado, tipografia Syne + Plus Jakarta), sem mexer em lógica de negócio. Só camada visual e de apresentação.

## 1. Base do sistema visual

- Escala tipográfica consistente: títulos de página, títulos de secção e legendas passam a usar apenas 4 tamanhos definidos, com `tracking` e peso fixos por nível.
- Ritmo de espaçamento único entre secções (mesma distância vertical no dashboard, academia, comunidade, ferramentas).
- Cartões: raio, hairline dourado subtil, sombra suave e estado hover unificados num único padrão reutilizável, em vez de variações por página.
- Estados de foco visíveis e consistentes (acessibilidade + sensação de produto acabado).

## 2. Dashboard

- Cabeçalho com saudação em tipografia display, dados do membro (ofensiva, progresso) numa linha discreta em vez de blocos soltos.
- O bloco "próximo passo" ganha tratamento de destaque principal: capa com gradiente, título grande, ação única bem visível.
- Rails (Academia, Aulas ao vivo, Shorts) com cabeçalho igual, setas de scroll no desktop e cartões com proporção fixa — fim dos blocos vazios/pretos.
- Skeletons com a forma real do conteúdo em vez de rectângulos genéricos.

## 3. Academia e aula

- Cartões de curso com capa em 16:9, barra de progresso fina e etiqueta de estado (novo / a meio / concluído).
- Página do curso: acordeão de módulos mais legível — aula atual destacada, aulas concluídas em tom apagado, duração alinhada à direita.
- Página da aula: player com respiração à volta, separadores (notas, recursos, transcrição) com estilo consistente e barra de progresso do módulo no topo.

## 4. Comunidade e ferramentas

- Cartões de post e comentários com hierarquia mais clara (avatar, nome, tempo, badges) e menos ruído de bordas.
- Filtros horizontais e composer alinhados ao mesmo padrão de "pill".
- Grelha de ferramentas com ícones e descrições uniformes.

## 5. Mobile e movimento

- Revisão mobile em todas as páginas acima: alvos de toque ≥44px, sem overflow horizontal, barra inferior coerente.
- Micro-animações discretas (entrada de cartões, hover, transição de separadores) com duração curta e respeito por `prefers-reduced-motion`.

## Notas técnicas

- Tokens e utilitários novos ficam em `src/styles.css` (`@theme` / `@utility`); nada de cores hardcoded nos componentes.
- Padrão de cartão e cabeçalho de secção centralizados em `src/components/mm/rail.tsx`, `section-heading.tsx` e num novo componente de cartão partilhado, reutilizado pelas páginas.
- Alterações limitadas a componentes de apresentação e rotas de UI; hooks de dados, server functions e base de dados não são tocados.
- Verificação no fim: build, testes existentes e revisão visual em desktop e mobile das páginas principais.

## Fora de âmbito

- Novas funcionalidades, mudanças de fluxo ou alterações no admin (pode entrar numa fase seguinte).
