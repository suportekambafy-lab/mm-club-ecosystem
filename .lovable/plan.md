# MM Club Salas — Plataforma de Eventos Interativos (v2)

Aprovado **LiveKit Cloud**, com 3 alterações do utilizador:
1. **Adiar** Breakout Rooms + Speed Networking (fase posterior).
2. **Arquitetura modular** — cada feature (reactions, polls, questions, backstage, IA, futuros breakouts/networking) é um módulo independente, ativável/desativável por evento sem tocar no core.
3. **Modo Backstage** — sala privada pré-live para host + co-hosts + oradores testarem equipamento antes de entrar em direto.

## Arquitetura

```text
┌─ Publishers (host/co-host/oradores) ─┐
│ cam / mic / screen / audio sistema   │──┐
└──────────────────────────────────────┘  │
                                          ▼
                                  ┌──────────────────┐
                                  │ LiveKit Cloud    │
                                  │ SFU + Egress     │
                                  │ (2 rooms/live:   │
                                  │  backstage +     │
                                  │  main stage)     │
                                  └────────┬─────────┘
                                           │
        ┌──────────────────────────────────┼──────────────────────────┐
        ▼                                  ▼                          ▼
  Espectadores (subscrevem)     Supabase (estado da sala)     CF Stream
                                módulos: reactions/polls/           replays
                                questions/backstage/…
```

LiveKit gere media + presença técnica; Supabase é source of truth do estado de produto e da configuração de módulos por sala.

## Core vs Módulos (modular por design)

**Core (imutável, mínimo)**
- Sala + participantes + papéis + tokens
- Palco (join/leave, mic/cam/screen)
- Spotlight + layout
- Moderação (mute, kick, ban)
- Gravação + replay
- Backstage (sala pré-live)

**Módulos (opt-in por sala)** — registados num `roomModules` registry:
- `reactions`
- `questions`
- `polls`
- `chat` (já existe)
- `ai-assistant` (futuro)
- `breakouts` (futuro — adiado)
- `speed-networking` (futuro — adiado)

Contrato uniforme:
```ts
interface RoomModule {
  id: string;
  enabledByDefaultFor: LiveMode[]; // broadcast | interactive
  ServerRPC?: Record<string, ServerFn>;
  Panel?: ComponentType<RoomModuleProps>;   // painel lateral
  Overlay?: ComponentType<RoomModuleProps>;  // camada sobre o stage
  requires?: ("host" | "publisher")[];
}
```

Config guardada em `lives.enabled_modules` (jsonb). UI de criação lista os módulos com toggles. Adicionar breakouts/networking mais tarde = registar módulo novo, sem tocar em core.

## Modos + Backstage

- **Broadcast** (mantém stack CF Stream atual).
- **Interactive** (LiveKit).

Backstage aplica-se aos dois modos:
- Cada `live` interativa tem duas rooms LiveKit lógicas: `mmclub_live_<id>_backstage` e `mmclub_live_<id>_main`.
- Host + co-hosts + oradores entram primeiro no backstage: mic/cam/screen preview, chat privado, checklist de equipamento (mic level meter, câmara ok, screen share test), latência/bandwidth check.
- Participantes veem contador "A sessão está a ser preparada".
- Host clica **"Entrar em direto"** → server fn move os publishers para a room `main`, define `lives.status = 'live'` e `started_at`, dispara gravação Egress. Backstage fica disponível em paralelo (bastidores durante a live: sussurros entre oradores fora do ar). Módulos configurados aparecem no painel.
- Gravação apenas cobre a room `main`.

## Papéis

| Papel | Backstage | Palco Main | Modera |
|---|---|---|---|
| Host | ✅ | ✅ | ✅ total |
| Co-host | ✅ | ✅ | ✅ (não encerra) |
| Orador | ✅ | ✅ (promovido) | ❌ |
| Participante | ❌ | ⚠️ via mão/convite | ❌ |
| Espectador | ❌ | ❌ | ❌ |

Se host cai >30s → co-host mais antigo promovido a host automaticamente.

## Schema (migration)

- `lives.mode` (`broadcast|interactive`), `lives.enabled_modules` (jsonb), `lives.spotlight_user_id`, `lives.stage_layout` (`solo|host_guest|spotlight|grid`), `lives.backstage_started_at`, `lives.went_live_at`.
- `live_participants` — role, room (`backstage|main`), on_stage, mic/cam/screen_allowed, hand_raised_at, invited_at, connection_quality, joined_at, kicked_at, banned.
- `live_stage_events` — auditoria (raise/invite/approve/promote/mute/kick/…).
- Tabelas por módulo (isoladas, só criadas se módulo ativo no projeto):
  - `live_reactions`
  - `live_questions`
  - `live_polls` + `live_poll_options` + `live_poll_votes`
- RLS: host/co-host escrevem tudo; participantes escrevem só o seu; banned bloqueados; backstage só visível a role ≥ orador.

## Server

`src/lib/livekit.server.ts` — SDK LiveKit isolado; emite tokens com `VideoGrant` por papel + sala (backstage/main); re-emite em cada promoção.

`src/lib/live-room.functions.ts` — **core apenas**:
- `joinRoom({liveId, target: 'backstage'|'main'})`
- `goLive({liveId})` — host-only; move publishers para main, marca started_at, arranca Egress.
- `endLive({liveId})` — para Egress, publica replay.
- `raiseHand`, `inviteToStage`, `approveHand`, `denyHand`, `promoteToStage`, `demoteFromStage`, `setRole`
- `setMic`, `setCam`, `setScreen`, `muteAll`
- `setSpotlight`, `setStageLayout`
- `kick`, `ban`

Módulos vivem em `src/lib/room-modules/<id>/` — cada um exporta `functions.ts` (RPCs), `Panel.tsx`, `Overlay.tsx`, `schema.sql`.

## Frontend (`src/components/mm/room/`)

- `interactive-room.tsx` — LiveKit `<Room>` provider + orquestração de módulos ativos.
- `backstage.tsx` — preview grid, mic level meter, device selectors, network stats, checklist, botão "Entrar em direto" (host).
- `stage.tsx` — grelha adaptativa + layouts (solo, host_guest, spotlight, grid); troca sem reconectar.
- `participant-tile.tsx` — vídeo/avatar + verified + indicadores + menu contextual do host.
- `local-controls.tsx` — mic/cam/screen (com áudio sistema onde possível), mão, sair, seletor de dispositivos inline (sem sair da sala).
- `host-panel.tsx` — participantes, qualidade (`ConnectionQuality`), voz ativa, pedidos de palco, ações completas, toggle de módulos ao vivo.
- `invitation-toast.tsx` — "O anfitrião convidou-te para o palco".
- `module-slot.tsx` — renderiza `Panel`/`Overlay` dos módulos ativos.

Módulos incluídos na v1:
- `reactions` — overlay flutuante (👏 ❤️ 🔥 😂 👍) + throttle server 1/s.
- `questions` — separador com upvote, marcar respondida, destacar (banner sobre stage).
- `polls` — criar/lançar/fechar + barras em tempo real + projetar resultado no stage.
- `chat` — atualiza componente existente para consumir novo estado.

## Resiliência

- LiveKit reconecta sozinho (Wi-Fi ↔ 5G, sleep, refresh).
- Gravação **server-side via LiveKit Egress** — imune a refresh/queda do host.
- Watchdog server: retry Egress + alerta.
- Replay: Egress → MP4 → upload CF Stream (usa `cloudflare-stream.server.ts`) → `recording_video_uid` → replay unificado.

## Fases

1. **Fase 1** — Infra LiveKit + core (rooms backstage+main, papéis, tokens) + wizard de modo/módulos + coexistência com Broadcast.
2. **Fase 2** — Backstage completo (preview, device checks, "Entrar em direto") + palco (mão/convite/spotlight/layouts).
3. **Fase 3** — Moderação completa + qualidade + transferência automática de host.
4. **Fase 4** — Módulos: reactions, questions, polls.
5. **Fase 5** — Gravação Egress + replay unificado.
6. **Fase 6 (adiado)** — Módulos breakouts + speed-networking, quando core estiver estável em produção.

## Preciso de ti para arrancar a Fase 1

1. Cria projeto em **LiveKit Cloud** → https://cloud.livekit.io (grátis, sem cartão).
2. Em Settings → Keys, cria uma API Key. Precisamos de 3 valores:
   - `LIVEKIT_URL` (ex: `wss://mmclub-xxxxx.livekit.cloud`)
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
3. Diz-me "avança" e eu abro o formulário seguro para colares os 3 valores. Depois começo pela migration + `livekit.server.ts` + wizard de modo/módulos.
