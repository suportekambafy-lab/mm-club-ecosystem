# Vistoria MM Club — 8 melhorias (design, funcionalidades, estabilidade)

Vistoria feita ao código atual da app de membro (dashboard, academia, comunidade, shorts, perfil, ferramentas) e ao PWA. Abaixo o que vale mais a pena mudar, por ordem de impacto. Nada de faturação, planos ou segurança neste âmbito.

## 1. Corrigir o aviso de hidratação na página de entrada
A página `/auth` está a gerar um erro de hidratação (o HTML do servidor não coincide com o do browser), o que provoca um "salto" visual ao abrir o login. Corrigir a origem para o login abrir estável e sem re-render completo.

## 2. Comunidade e Shorts a carregar por blocos
A Comunidade pede 200 registos de reações de uma só vez e os Shorts pedem 300 registos de interações — tudo num pedido, tudo renderizado. Passam a carregar por blocos com "carregar mais" automático, e as reações/interações só das publicações visíveis. Ganho direto em telemóveis com ligação fraca (é onde a maioria usa).

## 3. Listas longas viradas para desempenho
Feed da Comunidade e feed de Shorts passam a manter em memória apenas os cartões próximos do ecrã (virtualização), montando e desmontando os restantes. Evita o "engasgo" ao fazer scroll depois de 30–40 publicações.

## 4. Dividir o código pesado das lives e do estúdio
As bibliotecas de live e de vídeo entram hoje quase todas no mesmo pacote inicial. Passam a ser carregadas só quando o membro entra numa sala de live, no MM Studio ou no editor. Quem só usa Academia e Comunidade abre a app bastante mais rápido.

## 5. Estados de carregamento coerentes em toda a app
O Dashboard já usa esqueletos; Academia, Shorts, Perfil e Lives ainda mostram conteúdo aos saltos. Uniformizar o padrão de esqueleto e transição suave em todas as páginas de membro, mais estados vazios com uma ação clara ("ainda não há publicações → criar a primeira").

## 6. Um único relógio para todas as contagens decrescentes
Existem contadores independentes a atualizar a cada segundo (lives, lançamentos, aulas, banners). Passam todos a partilhar o relógio central já existente na app, reduzindo trabalho contínuo e consumo de bateria no telemóvel.

## 7. Imagens e capas sempre otimizadas
11 das 61 imagens ainda carregam sem diferimento e várias sem dimensões definidas (causa do "salto" de layout). Todas passam a ter carregamento diferido e dimensões, com prioridade apenas na primeira imagem visível de cada página.

## 8. Navegação com pré-carregamento e barra inferior no telemóvel
Ao passar o dedo/rato num cartão de curso, aula ou live, os dados dessa página começam a carregar antes do clique. No telemóvel, reforçar a barra inferior com os 5 destinos mais usados (Dashboard, Academia, Comunidade, Shorts, Perfil) e indicador de secção ativa, para reduzir toques.

## Detalhes técnicos

- `/auth`: alinhar render SSR/cliente (remover ramos dependentes de `window`/data no primeiro render) e validar que o aviso de hidratação desaparece.
- `src/routes/_app.comunidade.tsx` e `src/routes/_app.shorts.tsx`: `useInfiniteQuery` + `.range()` em vez de `.limit(200)` / `.limit(300)`; reações carregadas por lote das publicações visíveis.
- Virtualização com `@tanstack/react-virtual` nos dois feeds.
- Code-splitting com `React.lazy` + `Suspense` para `livekit-client`/`@livekit/components-react`, `hls.js` e `@ffmpeg/*`, garantindo que não são alcançáveis pelo grafo SSR do dashboard.
- Reutilizar `src/hooks/use-ticker.ts` em `live-countdown`, `release-countdown`, `coming-soon`, `live-hero-banner` e `_app.lives.$liveId`.
- Imagens: `loading="lazy"` + `decoding="async"` + `width`/`height`; `fetchpriority="high"` só no herói.
- Pré-carregamento via `preload="intent"` nos `Link` de cartões e `queryClient.prefetchQuery` em hover/touch.
- Esqueletos reutilizando `src/components/mm/skeletons.tsx`.

## Fora deste âmbito

Faturação, Paddle/Mollie, recuperação de receita, admin financeiro, políticas de segurança e conteúdos das aulas ficam intocados. Sem alterações à identidade de marca — só fluidez, clareza e estados de interface.
