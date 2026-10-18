/**
 * Lembretes de calls agendadas (equipa comercial).
 * Chamado por pg_cron a cada 15 min com `Authorization: Bearer <CRON_SECRET>`.
 *
 * Envia dois lembretes ao responsável pela call:
 *  - "day": ~24h antes (janela 23h–25h)
 *  - "hour": ~15 min antes (janela 5–20 min)
 * Cada lembrete é enviado uma única vez por call (colunas de controlo em leads).
 */
import { createFileRoute } from '@tanstack/react-router'

const DAY_MIN_MS = 23 * 3600_000
const DAY_MAX_MS = 25 * 3600_000
const HOUR_MIN_MS = 5 * 60_000
const HOUR_MAX_MS = 20 * 60_000

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

function whenLabel(iso: string, kind: 'day' | 'hour'): string {
  const fmt = new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
  return kind === 'day' ? `Amanhã, ${fmt} (Lisboa)` : `Hoje, ${fmt} (Lisboa)`
}

async function sendReminders(kind: 'day' | 'hour') {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { sendTemplateEmail } = await import('@/lib/email-templates/send-email')

  const now = Date.now()
  const [from, to] =
    kind === 'day'
      ? [now + DAY_MIN_MS, now + DAY_MAX_MS]
      : [now + HOUR_MIN_MS, now + HOUR_MAX_MS]
  const flagCol = kind === 'day' ? 'call_reminder_day_sent_at' : 'call_reminder_hour_sent_at'

  const { data: leads, error } = await supabaseAdmin
    .from('leads')
    .select('id, nome, call_scheduled_at, responsavel_id')
    .eq('status', 'call_marcada')
    .not('responsavel_id', 'is', null)
    .is(flagCol, null)
    .gte('call_scheduled_at', new Date(from).toISOString())
    .lte('call_scheduled_at', new Date(to).toISOString())
    .limit(100)
  if (error) throw new Error(`leads query failed: ${error.message}`)

  let sent = 0
  for (const lead of leads ?? []) {
    const userId = lead.responsavel_id as string
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId)
    const email = userRes?.user?.email
    if (userErr || !email) {
      console.error(`[call-reminders] no email for user ${userId}: ${userErr?.message ?? 'no email'}`)
      continue
    }
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle()
    const closerName = (profile?.display_name as string | null) ?? 'Equipa'

    const result = await sendTemplateEmail('call-reminder', email, {
      templateData: {
        closerName,
        leadName: (lead.nome as string | null) ?? 'o lead',
        whenLabel: whenLabel(lead.call_scheduled_at as string, kind),
        kind,
      },
      idempotencyKey: `call-reminder-${kind}-${lead.id}`,
    })
    if (result.sent) sent++
    await supabaseAdmin
      .from('leads')
      .update({ [flagCol]: new Date().toISOString() } as never)
      .eq('id', lead.id)
  }
  return { scanned: (leads ?? []).length, sent }
}

export const Route = createFileRoute('/api/public/cron/call-reminders')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { data: cfg } = await supabaseAdmin
          .from('cron_secrets')
          .select('secret')
          .eq('name', 'call-reminders')
          .maybeSingle()
        const secret = cfg?.secret as string | undefined
        if (!secret) return Response.json({ error: 'missing_cron_secret' }, { status: 500 })
        const provided = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
        if (!provided || !timingSafeEqual(provided, secret)) {
          return Response.json({ error: 'unauthorized' }, { status: 401 })
        }
        try {
          const day = await sendReminders('day')
          const hour = await sendReminders('hour')
          return Response.json({ ok: true, day, hour })
        } catch (e) {
          console.error('[call-reminders] failed:', e)
          return Response.json({ error: String(e).slice(0, 300) }, { status: 500 })
        }
      },
    },
  },
})
