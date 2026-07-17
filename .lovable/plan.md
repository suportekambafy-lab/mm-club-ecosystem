# Notificações da Comunidade

Adicionar notificações reais para atividade da comunidade e integrá-las no sino do topbar (que hoje só mostra lives e "continua a aprender").

## O que o utilizador verá

- Sino no topbar passa a mostrar também:
  - **Like** — "Alguém gostou do teu post/comentário"
  - **Resposta** — "Alguém comentou no teu post" / "Alguém respondeu ao teu comentário"
  - **Menção** — "Foste mencionado por @nome" (via `@handle` em posts/comentários)
- Badge com contador de não lidas (real, vindo da BD; não localStorage).
- Clicar leva para `/comunidade` com o post relevante em foco (scroll + highlight temporário).
- Botão "Marcar tudo como lido" e dispensar individual.
- Realtime: novas notificações aparecem sem refresh.

## Backend (migração)

Nova tabela `public.notifications`:

```
id uuid pk
user_id uuid  -- destinatário
actor_id uuid -- quem gerou a ação (pode ser null p/ sistema)
kind text check in ('like','reply','mention')
post_id uuid null references community_posts
comment_id uuid null references community_comments
read_at timestamptz null
created_at timestamptz default now()
```

- Índice em `(user_id, created_at desc)` e parcial em não lidas.
- GRANTs: `authenticated` SELECT/UPDATE (só as próprias); `service_role` ALL.
- RLS: `user_id = auth.uid()` para SELECT/UPDATE. INSERT só via triggers (security definer).
- Publicação realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE notifications`.

Triggers (SECURITY DEFINER):

- `on_community_likes_insert` → cria notificação `like` para o dono do post/comentário (skip self-like).
- `on_community_comments_insert` → cria notificação `reply` para o dono do post (e para o dono do comentário pai se `parent_id`), skip self.
- Menções: parse `@handle` no `body` de posts/comentários → resolver via `profiles.display_name` (case-insensitive, sem espaços) → inserir `mention` (skip self, dedupe com like/reply do mesmo evento).

## Frontend

- Novo módulo `src/lib/notifications.ts`:
  - `useNotifications()` — carrega lista + subscribe realtime na tabela filtrado por `user_id`.
  - `markAllRead()`, `markRead(id)`, `dismiss(id)` (dismiss = soft, usando `read_at` + filtro local; ou coluna `dismissed_at` se necessário — decidir no impl).
- Refatorar `src/components/mm/notifications.tsx`:
  - Manter as fontes atuais (lives + progress) e **mergear** com as novas notificações da BD.
  - Ordenar por `created_at`.
  - Ícones: `Heart` (like), `MessageCircle` (reply), `AtSign` (mention).
  - Links: `/comunidade?post=<id>` (ou `#post-<id>`).
- Em `_app.comunidade.tsx`: ao carregar com `?post=<id>`, scroll + ring dourado temporário no post.
- Parsing de menções no render dos posts/comentários: transformar `@nome` em link para perfil/destaque (leve, opcional nesta iteração — foco é criar as notificações).

## Detalhes técnicos

- `markAllRead` = `update notifications set read_at = now() where user_id = auth.uid() and read_at is null`.
- Contador não lidas = `count(*) where read_at is null`.
- Realtime channel: `notifications:user_id=eq.<uid>`.
- Self-notify: sempre skip (`actor_id = user_id`).
- Mentions: se um comentário tem menção **e** já dispara reply para o mesmo user, preferir `mention` (não duplicar).

## Fora do âmbito

- Emails/push.
- Notificações de lives/eventos novos (mantém-se derivado como hoje).
- UI de definições de notificação por utilizador.
