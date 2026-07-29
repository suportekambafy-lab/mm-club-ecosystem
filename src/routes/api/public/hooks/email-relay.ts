/**
 * Email relay: receives the payload the Lovable email SDK would POST to
 * Lovable's managed send API and forwards it to Resend (connector gateway),
 * so every system email (auth + transactional) shows up in the Resend
 * dashboard.
 *
 * Auth: the SDK sends `Authorization: Bearer <LOVABLE_API_KEY>`, which we
 * compare against the project's own key before doing anything.
 */
import { createFileRoute } from '@tanstack/react-router'

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend'

interface RelayPayload {
  to?: string
  from?: string
  subject?: string
  html?: string
  text?: string
  reply_to?: string
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

export const Route = createFileRoute('/api/public/hooks/email-relay')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const lovableKey = process.env.LOVABLE_API_KEY
        const resendKey = process.env.RESEND_API_KEY
        if (!lovableKey || !resendKey) {
          return Response.json({ error: 'missing_credentials' }, { status: 500 })
        }

        const provided = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
        if (!provided || !timingSafeEqual(provided, lovableKey)) {
          return Response.json({ error: 'unauthorized' }, { status: 401 })
        }

        let payload: RelayPayload
        try {
          payload = (await request.json()) as RelayPayload
        } catch {
          return Response.json({ error: 'invalid_json' }, { status: 400 })
        }

        const { to, from, subject, html, text, reply_to } = payload
        if (!to || !from || !subject || (!html && !text)) {
          return Response.json({ error: 'invalid_payload' }, { status: 400 })
        }

        const res = await fetch(`${GATEWAY_URL}/emails`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${lovableKey}`,
            'X-Connection-Api-Key': resendKey,
          },
          body: JSON.stringify({
            from,
            to: [to],
            subject,
            ...(html ? { html } : {}),
            ...(text ? { text } : {}),
            ...(reply_to ? { reply_to } : {}),
          }),
        })

        const body = await res.text()
        if (!res.ok) {
          console.error(`[email-relay] resend failed [${res.status}]: ${body}`)
          return Response.json({ error: body.slice(0, 500) }, { status: res.status })
        }

        let messageId: string | undefined
        try {
          messageId = (JSON.parse(body) as { id?: string })?.id
        } catch {
          messageId = undefined
        }

        return Response.json({ success: true, message_id: messageId, status: 'sent' })
      },
    },
  },
})
