# Redesign interno MM Club — Cinematic Premium

Vou alinhar todo o painel interno à linguagem premium da landing (preto + dourado + espaço + tipografia editorial), inspirado em **MasterClass / Apple TV / Netflix / Linear**. Deixa de parecer dashboard SaaS e passa a parecer um produto de consumo premium.

O componente `hero.tsx` que colaste é uma referência visual (BASE / SocialFi) — não vou copiá-lo literal (é de outra marca), mas vou puxar os princípios: tipografia gigante, cartões de vidro flutuantes, hierarquia dramática, respiração generosa.

## Escopo desta iteração

Foco em **4 superfícies principais** + sidebar. Sem tocar em lógica de negócio, backend, permissões, dados.

### 1. Sidebar — Reduzida ao essencial, editorial
- Reorganizar ordem: **INÍCIO · ACADEMIA · JADE · AO VIVO · COMUNIDADE · FERRAMENTAS · EVENTOS**
- Tipografia maior, tracking mais aberto (uppercase leve), mais espaço vertical entre itens
- Remover divisões visuais desnecessárias, hairlines só onde faz sentido
- Estado ativo com marca dourada lateral (barra fina) em vez de bg-fill
- Manter collapsible actual

### 2. Dashboard — Netflix / Apple TV
Nova ordem e composição:

```text
┌─────────────────────────────────────────────┐
│  HERO CINEMATOGRÁFICO                       │
│  Vídeo autoplay full-bleed (aspect 21/9)   │
│  Overlay: "Bom regresso, Victor."           │
│  Sub: "Continua a construir a tua Marca..." │
│  Sem controlos visíveis, mute, loop         │
└─────────────────────────────────────────────┘

── Continuar a aprender (rail horizontal, thumbnails grandes)
── Próxima Live (banner cinemático, não card)
── Jade (bloco editorial largo, não CTA compacto)
── Ferramentas (rail)
── Comunidade (feed preview estilo social)
── Eventos (rail)
```

- Remover o vídeo YouTube pequeno centrado actual → substituir por **hero full-bleed** com o mesmo vídeo mas com aspect ratio cinematográfico e overlay de texto editorial
- Saudação personalizada com nome do user (`user.name`) em display font gigante
- Thumbnails dos cursos maiores (400px em vez de 300px), hover com scale+glow dourado subtil
- Remover a duplicação de "Cursos" logo abaixo de "Continua a aprender" (redundância actual)

### 3. Academia — Streaming de conhecimento
- Hero editorial no topo com destaque de 1 curso featured (imagem gigante, tipografia grande)
- Grid de cursos com thumbnails maiores estilo MasterClass (aspect 3/4 tipo poster, ou 16/9 grandes)
- Hover: escurece vizinhos, curso destaca com título + expert + duração
- Secção "Especialistas" com fotos grandes circulares

### 4. Lives — O palco
- Página `/lives` como palco: banner enorme com próxima live (ou live activa)
- Countdown grande e dramático
- Foto do especialista em destaque
- Grid abaixo: replays estilo Netflix thumbnails

### 5. Comunidade — Rede social premium
- Layout tipo X/LinkedIn: feed central mais largo, sidebar direita com destaques
- Posts com mais respiração, avatares maiores, tipografia melhor
- Menos "caixas", mais divisores subtis

## Design tokens novos

Adicionar a `src/styles.css`:
- Gradiente hero dourado escuro (`--gradient-hero-cinematic`)
- Sombras douradas suaves para hover premium (`--shadow-gold-glow`)
- Aspect ratios cinematográficos onde precisar

Todas as cores vêm dos tokens existentes (`--primary` dourado, `--background`, `--surface-*`). Nada hardcoded.

## O que NÃO vou tocar

- Rotas, permissões, entitlements, backend
- Landing page (`index.tsx`), auth, checkout, admin
- Lógica de progresso, lives realtime, community CRUD
- Estrutura de dados (`src/data/*`)

## Ordem de implementação

1. Tokens CSS + sidebar reordenada e redesenhada
2. Dashboard: novo hero cinematográfico + ordem de rails
3. Academia: hero featured + grid poster
4. Lives: palco + countdown
5. Comunidade: feed social premium

Pronto para começar. Confirmas ou queres ajustar o escopo?