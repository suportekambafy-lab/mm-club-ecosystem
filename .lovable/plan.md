# Revisão MM Club — 9 melhorias (experiência do membro + velocidade)

Foco: a app abrir mais depressa, mexer-se mais fluida e não "engasgar" nas páginas com mais conteúdo. Sem mexer em regras de negócio, faturação ou segurança.

## O que vai mudar

### 1. Dividir o código pesado (maior ganho de velocidade)
Hoje não existe nenhum carregamento diferido no projeto: bibliotecas grandes de vídeo e lives (LiveKit, HLS, ffmpeg de junção de vídeo) entram no mesmo pacote que o dashboard. Passam a ser carregadas só quando o membro entra na sala de live, no MM Studio ou no editor.
Resultado: primeiro carregamento e navegação claramente mais leves para quem só usa Academia/Comunidade.

### 2. Comunidade com carregamento progressivo
O feed pede 50 publicações de uma vez (e 200 registos de reações), tudo renderizado de uma vez. Passa a carregar por blocos com "carregar mais" automático ao chegar ao fim, e as reações só das publicações visíveis.

### 3. Shorts mais leves
O feed pede até 50 shorts (e 300 registos de interações) numa só vez. Passa a paginar e a manter em memória apenas os vídeos próximos do atual, montando/desmontando os restantes.

### 4. Imagens sempre otimizadas
22 das 62 imagens da app ainda carregam sem diferimento. Todas passam a ter carregamento diferido (exceto a primeira imagem visível de cada página, que deve ser prioritária), com dimensões definidas para não haver "salto" de layout.

### 5. Um único relógio para contagens decrescentes
Existem vários contadores independentes a atualizar a cada segundo (lives, lançamento, aulas, banners). Passam todos a partilhar um relógio central, reduzindo trabalho contínuo no telemóvel e poupando bateria.

### 6. PWA com arranque instantâneo e ecrã offline
O service worker atual não guarda nada: cada arranque depende totalmente da rede. Passa a guardar a casca da app, ícones e imagens de capa, e a mostrar uma página offline em português quando não há ligação — mantendo pagamentos, autenticação e chamadas ao servidor sempre diretos à rede (sem cache), como hoje.

### 7. Transições e estados de carregamento coerentes
Alinhar os estados de espera das páginas de membro (Academia, Comunidade, Shorts, Perfil, Lives) ao padrão de esqueleto já usado no Dashboard e Perfil, com transição suave em vez de conteúdo a aparecer aos saltos.

### 8. Perfil mais rápido a abrir
A página de Perfil corre vários efeitos em série ao montar. Passa a mostrar o essencial de imediato (nome, avatar, plano) e a carregar progresso, cartões e preferências em segundo plano.

### 9. Navegação com pré-carregamento inteligente
Ao passar o rato/tocar num cartão de curso, aula ou live, os dados dessa página começam a ser carregados antes do clique, dando sensação de resposta imediata.

## Detalhes técnicos

- Code-splitting com `React.lazy` + `Suspense` para `livekit-client`/`@livekit/components-react` (salas e egress), `hls.js` (deteção de duração/frames) e `@ffmpeg/*` (`src/lib/video-merge.ts`), garantindo que nenhum destes módulos é alcançável a partir do grafo SSR do dashboard.
- Comunidade (`src/routes/_app.comunidade.tsx`) e Shorts (`src/routes/_app.shorts.tsx`): substituir `.limit(50)` / `.limit(200)` / `.limit(300)` por `useInfiniteQuery` com `.range()`, e usar `@tanstack/react-virtual` (já instalado, ainda sem uso) para listas longas.
- Relógio central: hook `useTicker(intervalMs)` num contexto único; substituir os `setInterval(…, 1000)` de `live-countdown`, `release-countdown`, `coming-soon`, `live-hero-banner` e `_app.lives.$liveId`.
- `public/sw.js`: adicionar `install` com precache da casca + estratégia stale-while-revalidate para imagens/ícones e `/offline`; manter as exclusões atuais (`/checkout`, `/auth`, `/vip`, `/_server`, `/admin`, `/academia`) em network-only.
- Pré-carregamento via `preload="intent"` nos `Link` dos cartões e `queryClient.prefetchQuery` nos handlers de hover/touch.
- Imagens: `loading="lazy"` + `decoding="async"` + `width`/`height`; `fetchpriority="high"` apenas no herói de cada página.

## Fora deste âmbito

Faturação, planos, Paddle/Mollie, políticas de segurança, admin financeiro e conteúdos das aulas ficam intocados. Nada de alterações visuais de marca — só fluidez e estados de carregamento.
