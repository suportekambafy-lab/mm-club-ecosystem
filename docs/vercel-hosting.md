# Running MM Club on Vercel

The Lovable deployment is unchanged. Everything below is opt-in through environment variables.

## How it works

- Build: `vite build` auto-detects Vercel (Nitro `vercel` preset). `vercel.json` installs from the public
  npm registry because `bun.lock` points at Lovable's private mirror.
- `src/lib/outbound-shim.server.ts` (enabled by `OFF_LOVABLE=1`) rewrites calls to Lovable-only gateways:
  AI gateway -> `AI_GATEWAY_BASE_URL`, and the Resend / Paddle / Firecrawl connectors -> the providers' own APIs.
  `LOVABLE_API_KEY` must still be set to any placeholder; it is never sent anywhere.
- `SAFE_MODE=1` makes a deployment safe to point at a copy of production data: emails and web push are
  swallowed, Stripe/Mollie only accept test keys, Viva only the demo environment, and any other host
  (the old app, CRM, Meta CAPI, partners) is blocked. `SAFE_MODE_ALLOW_HOSTS` adds hosts.
- `QUEUE_DISABLED=1` stops `drainQueue` from running any job.
- `VIVA_ENV=demo` uses Viva's demo environment (needs demo credentials).

## Environment variables

Never commit values. Set them in Vercel (Project Settings -> Environment Variables). Server-only keys must not
start with `VITE_`.

| Variable | Scope | Notes |
| --- | --- | --- |
| `OFF_LOVABLE` | server | `1` |
| `SAFE_MODE` | server | `1` on test deployments |
| `QUEUE_DISABLED` | server | `1` on test deployments |
| `SUPABASE_URL`, `VITE_SUPABASE_URL` | both | new project URL |
| `SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PROJECT_ID` | both | new project ref |
| `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY` | both | publishable / anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server | secret |
| `PUBLIC_APP_URL` | server | the deployment URL |
| `LOVABLE_API_KEY` | server | any placeholder |
| `AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL` | server | default base `https://ai-gateway.vercel.sh/v1` |
| `OPENAI_API_KEY` | server | when set without `AI_GATEWAY_API_KEY` (or with `AI_PROVIDER=openai`), chat, embeddings, images and transcription go straight to OpenAI. Optional model overrides: `OPENAI_CHAT_MODEL` (default `gpt-4.1-mini`), `OPENAI_CHAT_MODEL_LITE` (`gpt-4.1-nano`), `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_FALLBACK_MODEL` (`gpt-image-1`) |
| `GEMINI_API_KEY` | server | MM Studio video generation (Veo) in direct mode. Optional `GEMINI_VIDEO_MODEL` (default `veo-3.1-fast-generate-preview`) |
| `RESEND_API_KEY` | server | |
| `VIVA_MERCHANT_ID`, `VIVA_API_KEY`, `VIVA_SOURCE_CODE`, `VIVA_ENV` | server | demo credentials on test |
| `PADDLE_SANDBOX_API_KEY`, `PADDLE_LIVE_API_KEY`, `VITE_PAYMENTS_CLIENT_TOKEN` | server / build | `test_` token selects sandbox |
| `MOLLIE_API_KEY`, `STRIPE_SECRET_KEY` | server | test keys on test |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_EGRESS_S3_*`, `EGRESS_TEMPLATE_ORIGIN` | server | |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`, `CF_STREAM_WEBHOOK_SECRET` | server | |
| `CLOUDFLARE_STREAM_SIGNING_KEY_ID`, `CLOUDFLARE_STREAM_SIGNING_KEY_PEM` | server | optional; without them playback tokens are minted through the Stream API |
| `BUNNY_PULL_ZONE`, `VITE_BUNNY_PULL_ZONE`, `PANDA_DELIVERY_ZONE` | both | |
| `META_CAPI_ACCESS_TOKEN`, `META_CAPI_TEST_EVENT_CODE` | server | blocked in safe mode |
| `FIRECRAWL_API_KEY` | server | |
| `VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY`, `VITE_LOVABLE_CONNECTOR_POSTHOG_REGION` | build | |
| `WEB_PUSH_VAPID_SEED` | server | must match the old project or existing push subscriptions break |
| `CRON_SECRET` | server | new value; cron jobs must send it |

## Database side (new Supabase project)

- Keep `trg_request_push_notification_delivery` on `public.notifications` disabled until its URL points at the new app.
- Cron jobs are created disabled and only enabled at cutover, after the old project's jobs are off.
