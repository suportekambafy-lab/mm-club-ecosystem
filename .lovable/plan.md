
# Sistema de Lives Nativo — Cloudflare Stream + Chat MM Club

Objetivo: substituir os dados mock em `src/data/lives.ts` por um sistema real de lives com streaming Cloudflare Stream, controlo de acesso por subscrição/entitlement, gravação automática publicada na Academia, e chat próprio integrado ao login.

## Arquitetura

```text
Mentor (OBS) ──RTMP──▶ Cloudflare Stream Live Input
                            │
                            ├── HLS playback (signed tokens)  ──▶ Player MM Club
                            └── Recording (VOD) ──webhook──▶ backend ──▶ tabela lessons
                                                                    │
Membro ──login──▶ MM Club ──entitlement check──▶ Player + Chat (Realtime)
```

## Backend (migrations)

Nova tabela `lives`:
- `id`, `title`, `description`, `expert_id`
- `starts_at`, `duration_minutes`, `visibility` (`public|club|premium`)
- `cover_url`
- `cf_live_input_id`, `cf_stream_key` (só server), `cf_playback_id`
- `status` (`scheduled|live|ended|published`)
- `recording_video_uid` (Cloudflare Stream VOD id após término)
- `published_lesson_id` (FK opcional para a aula gerada)

Nova tabela `live_chat_messages`:
- `id`, `live_id`, `user_id`, `body`, `created_at`
- RLS: SELECT se o utilizador tem entitlement da live; INSERT só próprio.
- Ativar Realtime nesta tabela.

`GRANT`s + RLS conforme regras do projeto. Policies usam `has_role` e um helper `can_access_live(live_id, uid)` que valida entitlement/subscrição.

Tabela `lessons`/módulos já existe (via `courses`) — a gravação publicada cria uma aula "Gravação: {title}" num módulo especial "Lives gravadas" do curso associado ao mentor, ou numa área global "Lives".

## Server functions e rotas

`src/lib/lives.functions.ts` (createServerFn, requireSupabaseAuth):
- `listLives()` — próximas + gravadas visíveis ao utilizador.
- `getLive(id)` — devolve metadata + `playbackToken` (signed URL Cloudflare Stream) só se o utilizador puder aceder.
- `sendChatMessage(liveId, body)`.

`src/lib/lives.server.ts` (server-only):
- `createLiveInput()` — cria Live Input em Cloudflare Stream via API.
- `signPlaybackToken(videoUid)` — assina JWT para HLS privado.
- Admin-only server fns para criar/agendar lives (usa `supabaseAdmin` após verificar role admin).

Rotas HTTP em `src/routes/api/public/`:
- `cloudflare-stream/webhook.ts` — recebe eventos `live_input.connected`, `video.ready`. Verifica HMAC (`CF_STREAM_WEBHOOK_SECRET`), atualiza `lives.status`, e ao `video.ready` de uma gravação: cria aula em `lessons` com o `videoUid` e marca `status='published'`.

## Frontend

`src/routes/_app.lives.tsx` — lista real (server fn), estado ao vivo/agendada/gravada, badge "AO VIVO" pulsante.

`src/routes/_app.lives.$liveId.tsx` (nova) — página do evento:
- Player HLS (`hls.js` ou `<Stream />` de `@cloudflare/stream-react`) com token assinado.
- Painel de chat lateral com Realtime (`live_chat_messages`), input só para logados com acesso.
- Contagem regressiva antes do início.
- Após terminar: mostra CTA "Ver gravação na Academia" quando publicada.

`src/routes/admin.lives.tsx` — form para criar live (título, mentor, data, visibilidade, cover); ao criar chama `createLiveInput` e devolve RTMP URL + stream key para o mentor configurar no OBS.

## Controlo de acesso

- Server-side em `getLive`: verifica `visibility` vs entitlements + subscrição ativa (`has_active_subscription`). Só devolve token de playback se autorizado.
- Chat: RLS na tabela + server fn valida antes de inserir.
- Tokens Cloudflare Stream expiram em 2h, renováveis.

## Secrets necessários

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_STREAM_API_TOKEN`
- `CLOUDFLARE_STREAM_SIGNING_KEY_ID` + `CLOUDFLARE_STREAM_SIGNING_KEY_PEM` (para tokens JWT de playback privado)
- `CF_STREAM_WEBHOOK_SECRET`

Pedidos via `add_secret` depois da aprovação do plano.

## Fases de entrega

1. **Fase 1 — Fundação:** migrations (`lives`, `live_chat_messages`, policies, Realtime), server fns de leitura, página de detalhe da live com player e chat funcionais, secrets Cloudflare configurados.
2. **Fase 2 — Admin + ingestão:** rota admin para criar lives, criação automática de Live Input no Cloudflare, exibição de RTMP URL/key ao mentor.
3. **Fase 3 — Webhook + publicação automática:** endpoint público verificado, transição de estados, criação da aula gravada na Academia com o `videoUid` (usar o player Cloudflare também para VOD).
4. **Fase 4 — Polimento:** contagem regressiva, notificações, moderação de chat (delete pelo mentor/admin), presença ("X a assistir").

## Dependências npm

- `@cloudflare/stream-react` (player)
- `jose` (assinar JWT de playback)

## Notas técnicas

- Streamkey nunca sai do servidor exceto para o admin criador da live (server fn com role check).
- Player usa iframe do Cloudflare com `?signedURL=...` — evita ter que embutir hls.js e mantém DRM/tokens.
- Chat: canal Realtime `live:{liveId}`, filtro por `live_id`.
- Gravação: Live Inputs criam VOD automaticamente quando `recording.mode='automatic'` no create.

## Confirmação necessária

Antes de começar preciso confirmar:
1. Os secrets Cloudflare — vou pedi-los via formulário seguro depois de aprovares o plano. Precisas ter uma conta Cloudflare com Stream ativado (paga; ~$5/1000 min armazenados + $1/1000 min entregues).
2. Onde publicar a gravação: numa secção **"Lives" dedicada na Academia** (recomendado) ou dentro do curso do mentor correspondente?
3. Avanço já com as 4 fases seguidas, ou queres validar Fase 1 antes de continuar?
