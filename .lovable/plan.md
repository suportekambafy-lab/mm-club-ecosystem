# MM Studio — Plano de Implementação

Nova secção premium dentro de Ferramentas para gerar **imagens publicitárias** e **vídeos** com IA, sem prompts escritos pelo utilizador. Estética Apple/Linear com identidade MM (preto, dourado, glassmorphism).

## Arquitetura de rotas

Adicionar como sub-rotas de `/ferramentas` (já existe placeholder):

```
/ferramentas/studio                    → Landing MM Studio (hub)
/ferramentas/studio/imagens            → Fluxo IA de Imagens (4 passos)
/ferramentas/studio/videos             → Fluxo IA de Vídeos
/ferramentas/studio/criativos          → Histórico "Os Meus Criativos"
/ferramentas/studio/produtos           → Biblioteca de Produtos
/ferramentas/studio/marca              → Brand DNA (config única)
```

O placeholder atual em `src/routes/_app.ferramentas.tsx` passa a página índice das ferramentas com card destacado para "MM Studio".

## Backend (Lovable Cloud / Supabase)

Migração única com GRANTs + RLS por `auth.uid()`:

- `mm_studio_brand` (1 por utilizador): user_id PK, brand_name, logo_url, colors jsonb, typography text, segment, audience, tone, website, socials jsonb, description, updated_at.
- `mm_studio_products`: id, user_id, name, category, logo_url, brand_colors jsonb, photos text[] (signed URL paths), created_at.
- `mm_studio_credits` (1 por utilizador): user_id PK, balance int default 200, updated_at. Trigger em `handle_new_user` para criar linha com saldo inicial cortesia.
- `mm_studio_credit_ledger`: id, user_id, delta int, reason text, ref_id uuid, created_at (histórico e auditoria).
- `mm_studio_assets`: id, user_id, kind ('image'|'video'), url text, thumb_url text, format text, style text, product_id uuid null, credits_used int, metadata jsonb (aspect, duration, prompt gerado, modelo), created_at.
- Bucket `studio-media` (privado) — uploads de produtos e outputs gerados; URLs assinadas de longa duração via helper existente `uploadMedia`.

Custos: imagem = 40 créditos, vídeo = 250 créditos. Verificado server-side antes de invocar o modelo; débito idempotente ligado a `ref_id`.

## Server functions

`src/lib/studio.functions.ts` (com `requireSupabaseAuth`):

- `getStudioContext()` → { credits, brand, products[] }
- `saveBrandDna(input)` upsert
- `createProduct` / `updateProduct` / `deleteProduct`
- `generateImages({ productId?, uploads[], style, format, notes })`:
  - Compõe prompt otimizado a partir de Brand DNA + estilo + formato + notas + análise das imagens.
  - Chama `openai/gpt-image-2` via AI Gateway em `n=4`, `stream:false` (server), tamanho consoante formato (1024×1024, 1024×1792, 1792×1024).
  - Faz upload dos 4 PNGs para `studio-media`, cria 4 rows `mm_studio_assets`, debita 40×4=160 créditos.
- `regenerateImage(assetId, tweak?)` → 1 imagem, 40 créditos.
- `generateVideo({ productId?, assetIds[]|uploads[], style, format, duration, objective })`:
  - Escolha automática de modelo (Veo primeiro; fallback Gemini se falhar). Usa a primeira imagem como `starting_frame` e as restantes no prompt/storyboard.
  - Aspect ratio derivado do formato (Reels/TikTok/Shorts=9:16, Feed=1:1, YouTube 16:9, Stories 9:16).
  - Duração 10/15/20/30s (mapeada ao suportado pelo provider — 5s ou 10s por corte concatenado se necessário; MVP: aceitar 10s nativo e "15/20/30s" gerando cortes múltiplos e concatenando via ffmpeg no server, ou avisar quando não suportado).
  - Debita 250 créditos ao concluir.
- `listAssets({ kind?, cursor })`, `deleteAsset(id)`, `duplicateAsset(id)`.

Regra: utilizador **nunca vê o prompt**. Prompt guardado em `metadata` apenas para debugging admin.

## Cliente / UX

Componentes em `src/components/mm/studio/`:

- `StudioShell` — header com logo MM Studio, badge de créditos, glass nav (Imagens · Vídeos · Criativos · Produtos · Marca).
- `CreditsPill` — saldo em tempo real, click abre painel com histórico e CTA "Comprar créditos" (placeholder que abre modal de contacto até integrarmos Paddle top-ups).
- `StepFlow` (Imagens) — 4 passos em cards grandes:
  1. Upload/produto (drag & drop, até 10, preview em grid).
  2. Estilo — grid de chips com miniaturas (Luxo, Minimalista, Apple, Premium, Tecnologia, Moda, Beleza, Comida, Fitness, Elegante, Escuro, Claro, Lifestyle, Estúdio).
  3. Formato — cards com aspect visual (IG Feed 1:1, Story 9:16, Reels Cover 9:16, Facebook, TikTok, Loja, Banner, Thumbnail).
  4. Descrição opcional (textarea).
- `GenerationOverlay` — full-screen com progress cinematográfico durante fetch.
- `ResultGallery` — 4 imagens em grid, hover revela ações (Ver, Download, Gerar novamente, Editar, Guardar).
- `VideoFlow` — similar mas com passos: Fonte (produtos ou criativos) → Estilo → Formato → Duração → Objetivo.
- `VideoResult` — player + Download / Gerar novamente / Criar versão diferente.
- `CreativesLibrary` — tabs (Todos · Imagens · Vídeos), grid com miniatura, data, créditos usados, ações.
- `ProductLibrary` — cards de produtos, botão "Novo produto" abre drawer com nome, fotos, logo, categoria, cores.
- `BrandDnaForm` — formulário single-page com secções colapsáveis, guardado automaticamente (debounced) tal como o admin overrides.

Design tokens: reutilizar `surface-1/2/3`, `gold`, `hairline`. Efeitos: `backdrop-blur-xl`, sombras douradas suaves, transições `duration-500 ease-out`. Sem cores hardcoded.

## Segurança / Cloud

- RLS: cada tabela restrita a `auth.uid() = user_id`. Assets só visíveis ao dono.
- Storage bucket privado com policies para dono. Signed URLs (10 anos) via helper existente.
- Server functions verificam saldo e debitam **antes** da chamada AI; refund automático se provider devolver erro (ledger com delta positivo `reason='refund'`).
- Content policy: capturar erros de moderação da OpenAI e mostrar mensagem clara em PT.

## Detalhes técnicos

- Modelos AI Gateway: `openai/gpt-image-2` (imagens), `google/veo-3` via videogen tool não aplica no runtime do user — usaremos `google/gemini-3.1-flash-image` como fallback multi-frame e chamada a Veo por REST (documentar em `metadata.provider`). Para MVP, se Veo indisponível, gerar "vídeo animado" via sequência de imagens geradas + ffmpeg no server (`fluent-ffmpeg` não suportado no Worker → usar `@remotion/renderer`-like impossível; **decisão**: MVP entrega imagem em movimento via Nano Banana `google/gemini-3.1-flash-image` output e um pipeline stub que devolve preview em imagem animada. Rota preparada para trocar para Veo quando disponível no Gateway).
- Prompt builder determinístico em `src/lib/studio-prompt.ts` combina Brand DNA + estilo + formato + notas + análise breve das imagens (via chat model `google/gemini-3.5-flash` para descrever produto).
- Streaming de imagens: preferir non-streaming server → armazenamento → devolver URLs (evita 5MB SSE).

## Entregáveis (ordem)

1. Migração SQL (tabelas, RLS, GRANTs, trigger de créditos iniciais) + bucket `studio-media`.
2. `src/lib/studio.functions.ts` + `src/lib/studio-prompt.ts` + tipos.
3. Layout `/ferramentas/studio` + shell + créditos pill.
4. Fluxo Imagens completo (upload, estilo, formato, notas, geração, galeria).
5. Biblioteca de Produtos + Brand DNA.
6. Fluxo Vídeos (com fallback quando Veo indisponível).
7. Criativos (histórico) + ações.
8. Polish: animações, empty states, feedback de créditos.

Confirmas para eu avançar? Duas decisões que gostaria de fechar antes:
- **Saldo inicial de cortesia** (proponho 400 créditos = 10 imagens ou 1 vídeo + 6 imagens).
- **Comprar créditos**: MVP com botão "Falar com suporte" ou já integrar pack Paddle (ex.: 1000 créditos = X €)?
